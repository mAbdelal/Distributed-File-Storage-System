
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const express = require('express');
const router = express.Router();
const stream = require('stream')
const http = require('http')


const { serverFileSystem, servers, SERVER_NAME, SERVER_ADDRESS } = require('../config');


router.use(express.json());

// Helper Functions
const readDirectory = (dirPath) => fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];

const isUserExistsInServerFS = (username) => {
    const privatePath = path.join(serverFileSystem, 'private');
    try {
        return readDirectory(privatePath).includes(username);
    } catch (e) {
        return false;
    }
};


async function whereIsUser(username) {
    const serversToAsk = servers.filter(server => server.serverName != SERVER_NAME);

    const promises = serversToAsk.map(server =>
        fetch(`${server.serverAddress}/api/is-user-exists/${username}`).then( async response=>{
            if(response.ok){
                const json=await response.json()
                return Promise.resolve(json)
            }else{
                return Promise.reject(null)
            }
        })
    );

    try {
        const result = await Promise.any(promises)
        return result
    } catch (e) {
        return null
    }
}


// Middleware to add a x-served-by heade
router.use((req, res, next) => {
    res.set('x-served-by', SERVER_NAME);
    next();
});


router.get('/api/is-user-exists/:username', (req, res) => {
    const { username } = req.params;
    const userExists = isUserExistsInServerFS(username);
    const serverData = { serverName: SERVER_NAME, serverAddress: SERVER_ADDRESS }
    if(userExists){
        return res.status(200).json({ ...serverData, found: userExists });
    }else{
        return res.status(404).json({ ...serverData, found: userExists });
    }
});

router.get('/api/public-files', (req, res) => {
    const publicPath = path.join(serverFileSystem, 'public')

    function getPublicFiles() {
        const publicFilesNamesArray = [];
        const filesNames = fs.readdirSync(publicPath);

        for (const fileName of filesNames) {
            const fullPath = path.join(publicPath, fileName);
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                // Read files in subdirectory
                const publicPaths = fs.readdirSync(fullPath);
                publicFilesNamesArray.push(...publicPaths);
            }
        }
        return publicFilesNamesArray;
    }
    
    res.status(200).json(getPublicFiles())
})


router.get('/api/private-files/:userName', async (req, res) => {
    const { userName } = req.params

    if (isUserExistsInServerFS(userName)) {
        const privateUserFolderPath = path.join(serverFileSystem, 'private', userName)

        function getPrivateFiles() {
            const FilesNamesArray = [];
            const filesNames = fs.readdirSync(privateUserFolderPath);

            for (const fileName of filesNames) {
                FilesNamesArray.push(fileName);
            }
            return FilesNamesArray;
        }

        res.status(200)
        res.json(getPrivateFiles())
    } else {
        const serverData = await whereIsUser(userName);
        if (serverData) {
            const url = `${serverData.serverAddress}/api/private-files/${userName}?isRedirected=true`;
            const response = await fetch(url)
            const data = await response.json();
            res.status(response.status).json(data)
        }else{
            res.status(404).json('user not found')
        }
}
})


router.get('/api/download/public', (req, res) => {
    const { fileName } = req.query
    const publicFolderPath = path.join(serverFileSystem, 'public')

    if (!fileName) {
        res.status(400).json("filename is not specified")
    }

    function getPublicFilePath() {
        const internalFolderNames = fs.readdirSync(publicFolderPath);

        for (const folderName of internalFolderNames) {
            const fullPath = path.join(publicFolderPath, folderName);
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                // Read files in subdirectory
                const publicFilesPaths = fs.readdirSync(fullPath);
                for (const file of publicFilesPaths) {
                    if (file === fileName) {
                        return path.join(publicFolderPath, folderName, file)
                    }
                }
            }
        }
        return null;
    }

    const filePath = getPublicFilePath();
    if (!filePath) {
        res.status(404).json("file not fount")
    }
    res.status(200).download(filePath)
})

async function downloadFileFromAnotherServer(res, userName, serverData, fileName) {
    const url = new URL(`${serverData.serverAddress}/api/download/private`);
    url.searchParams.append("fileName", fileName);
    url.searchParams.append("userName", userName);
    url.searchParams.append("isRedirected", "true");
    res.redirect(url.toString());
}

router.get('/api/download/private', async (req, res) => {
    const { fileName, userName, isRedirected } = req.query
    if (!userName || !fileName) {
        return res.status(400).json("File name or username is missing");
    }
    try {
        if (isUserExistsInServerFS(userName)) {
            const pathToFile = path.join(serverFileSystem, 'private', userName, fileName);
            if (!fs.existsSync(pathToFile)) {
                return res.status(404).json("File not found");
            }
            return res.status(200).download(pathToFile);
        }
        if (isRedirected) {
            return res.status(404).json("User not found");
        }

        const serverData = await whereIsUser(userName);
        if (serverData) {
            const url = new URL(`${serverData.serverAddress}/api/download/private`);
            url.searchParams.append("fileName", fileName);
            url.searchParams.append("userName", userName);
            url.searchParams.append("isRedirected", "true");
            return res.redirect(url.toString());
        }else{
            return res.status(404).json("User not found");
        }

    } catch (e) {
        res.status(500).send('Internal Server Error');
    }
}
)

const syncWithOtherPeers = async (type, userName, fileName) => {
    const notifications = servers
        .filter((server) => server.serverName !== SERVER_NAME)
        .map((server) => fetch(`${server.serverAddress}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, userName, serverAddress: SERVER_ADDRESS, fileName: fileName }),
        }));

    try {
        await Promise.all(notifications);
    } catch (err) {
        console.error('Error syncing with peers:', err.message);
    }
};


router.get('/api/sync-download', async (req, res) => {
    const { type, userName, fileName } = req.query;

    if (!type || !userName || !fileName) {
        return res.status(400).send('Missing query parameters: type, userName, or fileName');
    }

    const filePath = path.join(serverFileSystem, type, userName, fileName);

    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('File not found');
        }

        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Type', 'application/octet-stream')
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res)
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});


router.post('/api/notify', async (req, res) => {
    const { type, userName, fileName, serverAddress } = req.body;

    if (!type || !userName || !fileName || !serverAddress) {
        return res.status(400).send('Missing required fields: type, userName, fileName, or serverAddress');
    }

    const parentDestinationPath = path.join(serverFileSystem, type, userName);
    const destinationPath = path.join(parentDestinationPath, fileName);

    try {
        // Create directory if it doesn't exist
        if (type === 'public') {
            await fs.promises.mkdir(parentDestinationPath, { recursive: true });
        } else if (type === 'private' && !isUserExistsInServerFS(userName)) {
            return res.status(200).json({ message: 'User does not exist in this server' });
        }

        // Fetch the file from the source server
        const url = new URL(`${serverAddress}/api/sync-download?userName=${userName}&fileName=${fileName}&type=${type}`);

        const response = await fetch(url);
        if (!response.ok) {
            return res.status(404).send('File not found on source server');
        }

        const writer = fs.createWriteStream(destinationPath);
        stream.pipeline(response.body, writer, (err) => {
            if (err) {
                res.status(500).send('error')
            } else {
                res.status(200).send('file downloaded')
            }
        });

    } catch (error) {
        console.error('Unexpected error:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

function pathToSaveFile(req) {
    const { type, userName } = req.query
    if (!userName || !type) {
        return null
    }
    if (type === 'public') {
        const userPublicFolderPath = path.join(serverFileSystem, 'public', userName)
        if (!fs.existsSync(userPublicFolderPath)) {
            fs.mkdirSync(userPublicFolderPath)
        }
        return userPublicFolderPath;
    } else if (type === 'private') {
        return path.join(serverFileSystem, 'private', userName);
    } else {
        return null
    }

}


// Set up storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const pathToSave = pathToSaveFile(req)
        if (pathToSave) {
            cb(null, pathToSave);  
        } else {
            cb(new Error('cannot find a path to upload file'))
        }
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);  
    }
});

// Initialize multer with storage options
const upload = multer({ storage: storage });


const acceptFile = async (req, res, next) => {
    const { type, userName } = req.query;

    if (!userName || !type) {
        return res.status(400).json('Missing required query parameters: type and userName');
    }

    if (type === 'public') {
        return next();
    }

    if (type === "private") {
        if (isUserExistsInServerFS(userName)) {
            return next();
        } else {
            const serverData = await whereIsUser(userName);
            console.log(serverData)
            if (serverData) {
                const fileName = req.headers['x-file-name'];

                // Validate necessary headers
                if (!fileName) {
                    return res.status(400).send('Missing file name in headers');
                }

                const fullURL = `${serverData.serverAddress}/api/redirect-upload?type=${type}&userName=${userName}&fileName=${fileName}`;
                const options = {
                    method: "POST",
                    headers: {
                        'Content-Type': req.headers['content-type'], 
                        'Content-Length': req.headers['content-length'], 
                        'x-file-name': fileName,
                    }
                };

                const forwardRequest = http.request(fullURL, options, response => {
                    if (response.statusCode === 200) {
                        return res.status(200).send('File forwarded successfully');
                    } else {
                        return res.status(500).send('Failed to forward file');
                    }
                });

                // Pipe request to forwardRequest
                stream.pipeline(
                    req,
                    forwardRequest,
                    (err) => {
                        if (err) {
                            console.error('Error during forwarding:', err);
                            forwardRequest.end();
                            return res.status(500).send('Error during forwarding');
                        }
                    }
                );
            } else {
                return res.status(400).json('User is not registered in this website');
            }
        }
    } else {
        return res.status(400).json('Cannot accept the file');
    }
};

router.post('/api/redirect-upload', upload.single('file'),async (req, res) => {
    const { userName, type, fileName } = req.query;
    if (!userName || !type || !fileName) {
        return res.status(400).send('Missing required parameters');
    }

    if (!req.file) {
        res.status(400).send('No file uploaded.');
    } else {
        res.status(200).send(`File uploaded successfully`);
        syncWithOtherPeers(type, userName, fileName)
    }
});

router.post('/api/upload', acceptFile, upload.single('file'), async (req, res) => {
    // the upload is coming to this server directly
    if (!req.file) {
        res.status(400).send('No file uploaded.');
    } else {
        res.status(200).send(`File uploaded successfully`);
        const { type, userName } = req.query
        syncWithOtherPeers(type, userName, req.file.filename)
    }

});


module.exports = router;