import { RDSClient, CreateDBInstanceCommand } from '@aws-sdk/client-rds';
import mysql from 'mysql2/promise';

const rdsClient = new RDSClient({
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  },
  region: 'us-east-2',
});

const dbConfig = {
  user: 'dolorian-dude',
  password: 'N8w5+8&x=SS5',
  database: 'pain-relief-db',
};

const createRDSInstance = async () => {
  const params = {
    DBInstanceIdentifier: 'pain-relief-db-instance',
    Engine: 'mysql',
    DBInstanceClass: 'db.t2.micro',
    MasterUsername: dbConfig.user,
    MasterUserPassword: dbConfig.password,
    AllocatedStorage: 19,
    DBName: dbConfig.database,
  };

  try {
    const command = new CreateDBInstanceCommand(params);
    const response = await rdsClient.send(command);
    console.log('RDS instance created:', response);
  } catch (err) {
    console.error('Error creating RDS instance:', err);
  }
};

const executeQueries = async () => {
  try {
    const connection = await mysql.createConnection(dbConfig);
  } catch (err) {
    console.error('Error executing SQL queries:', err);
  }
};
