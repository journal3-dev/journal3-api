import dotenv from "dotenv";
import express from "express";
import { ethers, BigNumber } from "ethers";
import bodyParser from "body-parser";
import { JOURNAL3TOKEN_ADDRESS } from "../constants";

dotenv.config();

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.get("/", (_, res) => {
  res.status(200).send("OK!");
});

app.post("/faucet", async (req, res) => {
  const userAddress = req.body.userAddress;
  const amount = req.body.amount;

  const ERC20ABI = require("../abi/Journal3TokenABI.json");

  var provider = new ethers.providers.JsonRpcProvider(
    process.env.QUICKNODE_HTTP_URL
  );

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const contract = new ethers.Contract(JOURNAL3TOKEN_ADDRESS, ERC20ABI, wallet);

  await contract.requestTokens(userAddress, BigNumber.from(amount), {
    gasLimit: 100000,
  });

  res.status(200).send("Sent!");
});

app.listen(port, () => console.log(`Running on port ${port}`));
