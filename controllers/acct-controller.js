import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { v4 as uuid } from 'uuid';
import { sendEmail } from '../util/sendEmail.js';

import {
  cache,
  storeUserData,
  getUserData,
  changeUserData,
  scan,
  getObj,
} from '../models/acct-model.js';

import OpenAI from 'openai';
const openai = new OpenAI();

const createAcct = async (req, res) => {
  const resToGetUserData = await getUserData(req.body);
  let resToStoreUserData;
  let userData = resToGetUserData.Item;
  if (userData) {
    res.sendStatus(400);
  } else {
    const verificationString = uuid();
    req.body.VerificationString = verificationString;

    resToStoreUserData = await storeUserData(req.body);

    sendEmail({
      to: req.body.Email,
      from: 'jcbenny.opco.llc@gmail.com',
      subject: "Let's verify your email",
      text: `Welcome aboard! To verify your email, click here: ${req.get(
        'origin'
      )}/verify-email/${verificationString}`,
    }).catch((e) => {
      console.log(e);
      res.sendStatus(500);
    });

    jwt.sign(
      {
        Email: req.body.Email,
        IsVerified: false,
      },
      process.env.JWT_SECRET,
      { expiresIn: '2d' },
      (err, token) => {
        if (err) return res.status(500).send(err);
        res.status(200).json({ token });
      }
    );
  }
};

const askToScan = async (req, res) => {
  // const expressionAttributeNames = req.params.ExpressionAttributeNames;
  console.log(req.get('host'));
  // switch (req.get('host')) {
  //   case '':
  // }
  // const exprs = Object.keys(expressionAttributeNames);

  // console.log('inside askToScan');
  // console.log(`exprs = ${exprs}`);

  // let projectionExpression = '';
  // let i;
  // for (i = 0; i < exprs.length - 1; i++)
  //   projectionExpression += `${exprs[i]}, `;
  // projectionExpression += exprs[i];

  // const data = await scan(projectionExpression, expressionAttributeNames);

  // return res.send(data);
  return;
};

const askToGetObj = async (req, res) => {
  const obj = await getObj(req.params);

  return res.send(obj);
};

const verifyEmail = async (req, res) => {
  const { VerificationString } = req.body;

  const projectionExpression = 'Email';
  const expressionAttributeValues = { ':v': req.body.VerificationString };
  const filterExpression = 'VerificationString = :v';
  const key = { Email: req.body.Email };

  const resToScan = await scan(
    projectionExpression,
    null,
    expressionAttributeValues,
    filterExpression,
    key
  );
  if (!resToScan.Count)
    return res
      .status(401)
      .json({ message: 'The email verification code is incorrect.' });

  const email = resToScan.Items[0].Email;
  req.body.Email = email;

  req.body.AttributeName = 'IsVerified';
  req.body.AttributeType = 'B';
  req.body.IsVerified = true;

  changeUserData(req.body);
  jwt.sign(
    { Email: email, IsVerified: true },
    process.env.JWT_SECRET,
    { expiresIn: '2d' },
    (err, token) => {
      if (err) return res.sendStatus(500);
      res.status(200).json({ token });
    }
  );
};

const logIn = async (req, res) => {
  const resToGetUserData = await getUserData(req.params);
  const userData = resToGetUserData.Item;

  //   if (userData) res.send(userData['First name'].S);
  if (!userData && resToGetUserData.status !== 304) return res.sendStatus(401);

  //   if (resToGetUserData.status == 304)
  //     res.send(JSON.stringify(cache[req.params.Email]));

  const passwordRight = await bcrypt.compare(
    req.params.Password,
    userData ? userData.Password : cache[req.params.Email].Password
  );

  if (!passwordRight) return res.sendStatus(401);

  jwt.sign(
    {
      Email: req.params.Email,
      IsVerified: false,
    },
    process.env.JWT_SECRET,
    { expiresIn: '2d' },
    (err, token) => {
      if (err) return res.status(500).json(err);
      res.status(200).json({ token });
    }
  );
};

const generateMerchImg = async (req, res) => {
  console.log('generating merch image NOW');

  const img = await openai.images.generate({
    model: 'dall-e-2',
    prompt: req.body.List.Description,
    n: 1,
    size: '1024x1024',
  });

  return res.send(img.data[0].url);
};

const storeMerchData = async (req, res) => {
  req.body.AttributeName = 'Merch';
  req.body.AttributeType = 'L';

  const resToChange = await changeUserData(req.body);

  console.log(
    'executing code after the sending of the command to the DynamoDB client'
  );

  return res.send(resToChange);
};

export {
  createAcct,
  askToScan,
  askToGetObj,
  verifyEmail,
  logIn,
  generateMerchImg,
  storeMerchData,
};
