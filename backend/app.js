const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const app = express();
const cors = require('cors');
const fileManagmentRouter = require('./src/routes/fileMangementRoutes')
const { PORT, SERVER_NAME } = require('./src/config')


if (!PORT || !SERVER_NAME) {
    console.log("port or server name are not specified")
    process.exit(1)
}

app.use(cors({
    // origin: allowedOrigins,
    exposedHeaders: ['x-served-by']  
}));
app.use(fileManagmentRouter)


// Start the server
app.listen(PORT, () => {
    console.log(`${SERVER_NAME} is running on port ${PORT}`);
});

