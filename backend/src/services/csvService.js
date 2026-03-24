import csvParser from "csv-parser";
import { Readable } from "node:stream";
import { ValidationError } from "../utils/errors.js";

export async function parseParticipantNames(csvBuffer) {
  const csvText = csvBuffer.toString("utf8").replace(/^\uFEFF/, "");

  return new Promise((resolve, reject) => {
    const names = [];
    let nameColumn = "";
    let settled = false;

    const fail = (message) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(new ValidationError(message));
    };

    Readable.from([csvText])
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => header.trim(),
        })
      )
      .on("headers", (headers) => {
        nameColumn = headers.find(
          (header) => header.toLowerCase() === "name"
        );

        if (!nameColumn) {
          fail('CSV must contain a "Name" column.');
        }
      })
      .on("data", (row) => {
        if (settled || !nameColumn) {
          return;
        }

        const name = row[nameColumn];
        if (typeof name === "string" && name.trim()) {
          names.push(name.trim());
        }
      })
      .on("end", () => {
        if (settled) {
          return;
        }

        if (!nameColumn) {
          fail('CSV must contain a "Name" column.');
          return;
        }

        if (!names.length) {
          fail("CSV does not contain any participant names.");
          return;
        }

        resolve(names);
      })
      .on("error", () => {
        fail("The CSV file could not be parsed.");
      });
  });
}

