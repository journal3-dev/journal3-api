var dotenv = require("dotenv");
var constants = require("../constants");

dotenv.config();

var express = require("express");
var ethers = require("ethers");
var bodyParser = require("body-parser");
var multer = require("multer");
const pinataSDK = require("@pinata/sdk");
const fs = require("fs");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
  filename: function (req, file, cb) {
    // cb(null, Date.now() + path.extname(file.originalname)); //Appending extension
    cb(null, file.originalname); //Appending extension
  },
});

const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(multer({ storage: storage }).any());

const Journal3TokenABI = require("../abi/Journal3TokenABI.json");
const OracleContractABI = require("../abi/OracleContractABI.json");
const Journal3JobsABI = require("../abi/Journal3JobsABI.json");

var provider = new ethers.providers.JsonRpcProvider(
  process.env.QUICKNODE_HTTP_URL
);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

app.get("/", (_, res) => {
  res.status(200).send("OK!");
});

app.post("/faucet", async (req, res) => {
  const userAddress = req.body.userAddress;
  const amount = req.body.amount;

  const contract = new ethers.Contract(
    constants.JOURNAL3TOKEN_ADDRESS,
    Journal3TokenABI,
    wallet
  );

  await contract.requestTokens(userAddress, ethers.BigNumber.from(amount), {
    gasLimit: 100000,
  });

  res.status(200).send("Sent!");
});

app.post("/upload-kaggle-notebooks", async function (req, res) {
  const fileName = req.files[0].originalname;
  const readableStreamForFile = fs.createReadStream("./uploads/" + fileName);

  const options = {
    pinataMetadata: {
      name: fileName,
    },
  };

  const { IpfsHash } = await pinata.pinFileToIPFS(
    readableStreamForFile,
    options
  );

  // add check with DataOnboarder here

  const userAddress = req.body.userAddress;

  const contract = new ethers.Contract(
    constants.ORACLE_CONTRACT_ADDRESS,
    OracleContractABI,
    wallet
  );

  await contract.setRawData(userAddress, IpfsHash, true, {
    gasLimit: 100000,
  });

  res.send("Uploaded notebooks to IPFS!");
});

app.post("/create-job", async function (req, res) {
  // add check with DataOnboarder here
  const userAddress = "0x83a1BB0A32B2c03877757a7eD7E9F18C8fbDa7eA";

  const contract = new ethers.Contract(
    constants.JOURNAL3JOBS_CONTRACT_ADDRESS,
    Journal3JobsABI,
    wallet
  );

  await contract.setRawData(userAddress, IpfsHash, true, {
    gasLimit: 100000,
  });

  res.send("Uploaded notebooks to IPFS!");
});

app.listen(port, () => console.log(`Running on port ${port}`));
