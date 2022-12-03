var dotenv = require("dotenv");
var constants = require("../constants");
var express = require("express");
var ethers = require("ethers");
var bodyParser = require("body-parser");
var multer = require("multer");
const pinataSDK = require("@pinata/sdk");
const fs = require("fs");

dotenv.config();
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
  filename: function (req, file, cb) {
    // cb(null, Date.now() + path.extname(file.originalname)); //Appending extension
    cb(null, file.originalname); //Appending extension
  },
});

const nameToOracleAddress = {};
nameToOracleAddress["kaggle.com"] = constants.ORACLE_CONTRACT_ADDRESS;

const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(multer({ storage: storage }).any());

const Journal3TokenABI = require("../abi/Journal3TokenABI.json");
const OracleContractABI = require("../abi/OracleContractABI.json");
const Journal3JobsABI = require("../abi/Journal3JobsABI.json");
const SkillNFTStandardABI = require("../abi/SkillNFTStandardABI.json");

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
  try {
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

    const txn = await contract.setRawData(userAddress, IpfsHash, true, {
      gasLimit: 100000,
    });

    await txn.wait();

    res.send("Uploaded notebooks to IPFS!");
  } catch (error) {
    console.log(error);
  }
});

const getParams = (tree) => {
  const qualifications = Object.keys(tree);
  const qualifications_size = qualifications.length;
  const qualification_filtering = Array.from(Array(qualifications_size), () =>
    new Array(qualifications_size).fill(0)
  );

  var checkpoints = [];

  for (var key in tree) {
    if (tree.hasOwnProperty(key)) {
      const value = tree[key];

      const childrenNodesArray = value[0];

      if (value.length > 1) {
        const checkPointInfo = value[1];
        const checkPoint = [key, checkPointInfo["candidate_profile"], []];
        checkpoints.push(checkPoint);
      }

      for (var i = 0; i < childrenNodesArray.length; i++) {
        const child = childrenNodesArray[i];
        qualification_filtering[parseInt(key) - 1][parseInt(child) - 1] = 1;
      }
    }
  }

  const checkpoint_size = checkpoints.length;

  return {
    qualifications,
    qualification_filtering,
    checkpoints,
    checkpoint_size,
    qualifications_size,
  };
};

app.post("/create-job", async function (req, res) {
  try {
    // add check with DataOnboarder here
    const fileName = req.files[0].originalname;
    const readableStreamForFile = fs.createReadStream("./uploads/" + fileName);

    const job = require("../uploads/" + fileName);

    const jobParams = getParams(job["tree"]);

    const options = {
      pinataMetadata: {
        name: fileName,
      },
    };

    const { IpfsHash } = await pinata.pinFileToIPFS(
      readableStreamForFile,
      options
    );

    const contract = new ethers.Contract(
      constants.JOURNAL3JOBS_CONTRACT_ADDRESS,
      Journal3JobsABI,
      wallet
    );

    const txn = await contract.createJob(
      IpfsHash,
      jobParams.qualifications,
      jobParams.qualification_filtering,
      jobParams.checkpoints,
      jobParams.checkpoint_size,
      jobParams.qualifications_size,
      job["root"],
      job["closing_indexer"]
    );

    await txn.wait();
    res.send("Created job!");
  } catch (error) {
    console.log(error);
  }
});

const getNftStandardInfo = (skillNftStandard) => {
  const oracle = nameToOracleAddress[skillNftStandard["oracle"]];
  const validator_keys = Object.keys(skillNftStandard["query"]);
  const validator_values = [];

  for (var key in skillNftStandard["query"]) {
    const value = skillNftStandard["query"][key];
    validator_values.push(skillNftStandard["query"][key]["$eq"]);
  }

  const token_gating = skillNftStandard["pre_req_check"];

  return { oracle, validator_keys, validator_values, token_gating };
};

app.post("/create-skill", async function (req, res) {
  try {
    // add check with DataOnboarder here
    const fileName = req.files[0].originalname;
    const skillNftStandard = require("../uploads/" + fileName);
    const skillNftStandardInfo = getNftStandardInfo(skillNftStandard);

    const contract = new ethers.Contract(
      constants.SKILL_NFT_STANDARD_CONTRACT_ADDRESS,
      SkillNFTStandardABI,
      wallet
    );

    const txn = await contract.create_skill(
      skillNftStandardInfo.oracle,
      skillNftStandardInfo.validator_keys,
      skillNftStandardInfo.validator_values,
      skillNftStandardInfo.token_gating
    );

    await txn.wait();

    res.send("Created skill standard!");
  } catch (error) {
    console.log(error);
  }
});

app.listen(port, () => console.log(`Running on port ${port}`));
