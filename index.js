import express from 'express';
import cors from 'cors';

import { check } from 'express-validator';
import {
  validateRegistration,
  confirmMatch,
  getRegistrationErr,
} from './validation/registration.js';

import {
  createAcct,
  askToScan,
  askToGetObj,
  verifyEmail,
  logIn,
  generateMerchImg,
  storeMerchData,
} from './controllers/acct-controller.js';

const app = express();

app.use(express.json());

const readPaths = [
  '/names-of-users',
  '/potential-buyers',
  '/merch',
  '/merch-imgs/:ImgFilename',
  '/emails/:Email/passwords/:Password',
];

const readHandlers = [askToScan, askToScan, askToScan, askToGetObj, logIn];

for (let i = 0; i < readPaths.length; i++)
  app.get(readPaths[i], cors(), readHandlers[i]);

const writePaths = [
  '/register',
  '/verify-email',
  '/private/sell-something/make-pic',
  '/private/sell-something/save-item-info',
];

const writeTypes = [0, 1, 0, 0];

const writeHandlers = [
  [
    validateRegistration,
    check('Password').custom(confirmMatch),
    getRegistrationErr,
    createAcct,
  ],
  [verifyEmail],
  [generateMerchImg],
  [storeMerchData],
];

const corsFriendlyWrite = (path, writeType, handlers, application = app) => {
  application.options(path, cors());
  if (writeType === 'post') application.post(path, cors(), ...handlers);
  else application.put(path, cors(), ...handlers);
};

for (let i = 0; i < writePaths.length; i++)
  corsFriendlyWrite(
    writePaths[i],
    writeTypes[i] ? 'put' : 'post',
    writeHandlers[i]
  );

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
