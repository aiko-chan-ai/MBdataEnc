import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import fs from "fs";
import path from "path";
import cryptoNode from "crypto";
import { JSDOM } from "jsdom";
import readline from "readline";

import wasm from "./loadWasm.js";

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

async function downloadFile(url) {
  const response = await client({
    url,
    method: "GET",
    responseType: "stream",
  });
  let filename = "";
  const disposition = response.headers["content-disposition"];
  if (disposition && disposition.includes("attachment")) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, "");
    }
  }
  if (!filename) {
    filename = path.basename(url);
  }
  const filePath = path.resolve(".", filename);
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

if (!fs.existsSync("./main.wasm")) {
  await downloadFile("https://online.mbbank.com.vn/assets/wasm/main.wasm");
}

function readLineAsync(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Get cookie, tưởng vậy nhưng không phải vậy
const htmlContent = await client.get("https://online.mbbank.com.vn/pl/login", {
  headers: {
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "vi-VN,vi;q=0.9",
    "sec-ch-ua":
      '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
});

const dom = new JSDOM(htmlContent.data);

const allScripts = dom.window.document.querySelectorAll(
  'script[type="module"]'
);

const matchingScript = Array.from(allScripts).find((script) =>
  /^\/main\.\w+\.js$/.test(script.getAttribute("src"))
);

console.log("> Script Main:", matchingScript.getAttribute("src"));
// cứ tưởng auth header thay đổi ...
const auth = "Basic RU1CUkVUQUlMV0VCOlNEMjM0ZGZnMzQlI0BGR0AzNHNmc2RmNDU4NDNm";

// Captcha Image
const captcha = await client.post(
  "https://online.mbbank.com.vn/api/retail-web-internetbankingms/getCaptchaImage",
  {
    refNo: "2024071018571949",
    deviceIdCommon: "ms7jhh48-mbib-0000-0000-2024071018571948",
    sessionId: "",
  },
  {
    headers: {
      Authorization: auth,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "vi-VN,vi;q=0.9",
      "sec-ch-ua":
        '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  }
);

fs.writeFileSync("./captcha.png", Buffer.from(captcha.data.imageString, "base64"));

const request = {
  userId: "0123456789",
  password: cryptoNode.createHash("md5").update("123456").digest("hex"),
  captcha: "123456",
  ibAuthen2faString: "c7a1beebb9400375bb187daa33de9659", // globalThis.sessionStorage?.getItem("FPR")
  sessionId: null,
  refNo: "0123456789-2024071018223800",
  deviceIdCommon: "ms7jhh48-mbib-0000-0000-2024071018571948",
};

const capt = await readLineAsync("Nhập captcha: ");

request.captcha = capt;

const dataEnc = await wasm(fs.readFileSync("./main.wasm"), request, "0");

// Login
const res = await client
  .post(
    "https://online.mbbank.com.vn/api/retail_web/internetbanking/v2.0/doLogin",
    {
      dataEnc,
    },
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "vi-VN,vi;q=0.9",
        app: "MB_WEB",
        authorization: auth,
        "content-type": "application/json; charset=UTF-8",
        "elastic-apm-traceparent":
          "00-2f346e62082f1d9b71c22fb4ae20760f-2f2c02091e76c71f-01",
        refno: "0123456789-2024071019251711",
        "sec-ch-ua":
          '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-request-id": "0123456789-2024071019251711",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
    }
  )
  .catch((e) => ({ data: e.message }));

console.log(res.data);
// Test ok