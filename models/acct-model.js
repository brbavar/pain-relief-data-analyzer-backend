import bcrypt from 'bcrypt';
import axios from 'axios';
import fs from 'fs';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

import {
  GetCommand,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  },
  region: 'us-east-2',
});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  },
  region: 'us-east-2',
});

const cache = {};
let dynamoInput = { TableName: 'jcbenny-accts' };
let s3Input = { Bucket: 'jcbenny-merch-imgs' };

const storeUserData = async (reqPayload) => {
  cache[reqPayload.Email] = reqPayload;

  let key = { Email: reqPayload.Email };
  dynamoInput.Item = key;

  const encryptedPassword = await bcrypt.hash(reqPayload.Password, 10);
  dynamoInput.Item.Password = encryptedPassword;

  dynamoInput.Item.IsVerified = false;
  dynamoInput.Item.VerificationString = reqPayload.VerificationString;

  dynamoInput.Item.Merch = [];

  for (let key of Object.keys(reqPayload))
    if (
      !Object.keys(dynamoInput.Item).includes(key) &&
      !['Password', 'Create account', 'Confirm password'].includes(key)
    ) {
      dynamoInput.Item[key] = reqPayload[key];
    }

  return dynamoDocClient.send(new PutCommand(dynamoInput));
};

const getUserData = (reqPayload) => {
  let key = { Email: reqPayload.Email };
  dynamoInput.Key = key;

  return dynamoDocClient.send(new GetCommand(dynamoInput));
};

const changeUserData = (reqPayload) => {
  console.log(`attributes of reqPayload = ${Object.keys(reqPayload)}`);

  let key = { Email: reqPayload.Email };
  dynamoInput.Key = key;

  const attr = reqPayload.AttributeName;
  dynamoInput.UpdateExpression = `SET ${attr} = `;
  switch (reqPayload.AttributeType) {
    case 'L':
      const merch = reqPayload.Merch; // Currently, can assume there is merch in payload if 'L' (for list) is the attribute type
      // Download img file from URL
      const imgFilename = `merch-img-${crypto.randomUUID()}.png`;
      const imgFile = fs.createWriteStream(imgFilename);
      axios.get(merch.S3Data.ImgURL).then((res) => {
        res.pipe(imgFile);
        imgFile.on('finish', () => {
          imgFile.close();

          // Upload img file to S3
          s3Input.Key = imgFilename;
          s3Client.send(new PutObjectCommand(s3Input));

          // Add to DynamoData the info needed to access img stored in S3
          merch.DynamoData.ImgFilename = imgFilename;
        });
      });

      dynamoInput.ExpressionAttributeValues = {
        ':v': [Object.values(merch.DynamoData)],
      };
      dynamoInput.UpdateExpression += `list_append(${attr}, :v)`;
      break;
    case 'B':
      dynamoInput.UpdateExpression += reqPayload[attr];
      break;
  }

  return dynamoDocClient.send(new UpdateCommand(dynamoInput));
};

const scan = (
  proj = '',
  attrNames = null,
  attrVals = null,
  filt = '',
  key = null
) => {
  if (key) dynamoInput.Key = key;

  if (attrNames) dynamoInput.ExpressionAttributeNames = attrNames;
  if (attrVals) dynamoInput.ExpressionAttributeValues = attrVals;
  if (filt) dynamoInput.FilterExpression = filt;
  if (proj) dynamoInput.ProjectionExpression = proj;

  return dynamoDocClient.send(new ScanCommand(dynamoInput));
};

const getObj = (reqPayload) => {
  s3Input.Key = reqPayload.ImgFilename; // Currently, can assume object to get is an img

  return s3Client.send(new GetObjectCommand(s3Input));
};

export { cache, storeUserData, getUserData, changeUserData, scan, getObj };
