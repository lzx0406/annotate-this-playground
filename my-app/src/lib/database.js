import dotenv from "dotenv";

import mysql from "mysql2/promise";

// export const db = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: 3306,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// @ts-ignore
export const db = mysql.createPool({
  host: "aiexpertsdb.ch0mqku8apof.us-east-2.rds.amazonaws.com",
  user: "admin",
  password: "m8hfn.p1QHP9Zv$D?ypZf(ZTDq>A",
  // password: secret,
  database: "aiexpertsnews",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// import {
//   SecretsManagerClient,
//   GetSecretValueCommand,
// } from "@aws-sdk/client-secrets-manager";

// /**
//  * @type {mysql.Pool}
//  */
// let db;

// // @ts-ignore
// const client = new SecretsManagerClient({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// async function getDatabaseCredentials() {
//   try {
//     const response = await client.send(
//       new GetSecretValueCommand({
//         SecretId: process.env.SECRET_NAME,
//         VersionStage: "AWSCURRENT",
//       })
//     );

//     if ("SecretString" in response) {
//       return JSON.parse(response.SecretString);
//     }
//   } catch (error) {
//     console.error("Error retrieving database credentials:", error);
//     throw new Error("Could not retrieve database credentials");
//   }
// }

// export async function initDb() {
//   if (!db) {
//     const { host, username, password, database } =
//       await getDatabaseCredentials();

//     db = mysql.createPool({
//       host: host || "aiexpertsdb.ch0mqku8apof.us-east-2.rds.amazonaws.com",
//       user: username || "admin",
//       password: password,
//       database: database || "aiexpertsdb",
//       waitForConnections: true,
//       connectionLimit: 10,
//       queueLimit: 0,
//     });

//     console.log("Database pool created successfully");
//   }
// }

// export { db };
