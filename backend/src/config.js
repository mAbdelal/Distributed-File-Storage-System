const path=require('path')
const fullPath = __dirname.split(path.sep)
const serverFileSystem = path.join(fullPath[0], fullPath[1], `${process.argv[3]}_FS`)

const servers =
    [
        { serverName: "server_A", serverAddress: "http://localhost:3000" },
        { serverName: "server_B", serverAddress: "http://localhost:3001" },
        { serverName: "server_C", serverAddress: "http://localhost:3002" }
    ]




const PORT = process.argv[2];
const SERVER_NAME = process.argv[3];

function getServerAddress() {
    for (const server of servers) {
        if (server.serverName === SERVER_NAME) {
            return server.serverAddress
        }
    }
}

const SERVER_ADDRESS = getServerAddress()



module.exports={servers,PORT,SERVER_NAME,serverFileSystem,SERVER_ADDRESS}



