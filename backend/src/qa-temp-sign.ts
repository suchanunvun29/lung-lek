import dotenv from "dotenv";
dotenv.config();
import { signAuthToken } from "./utils/jwt";

const managerToken = signAuthToken({ sub: "cmst70j8c0005mnmy1xtekpvy", role: "MANAGER" });
const spToken = signAuthToken({ sub: "cmsu1xxul0000rw0kn2nqctyl", role: "SALESPERSON" });
const spNoLinkToken = signAuthToken({ sub: "cmstquux1001rpoyv5wpzbxwc", role: "SALESPERSON" });

console.log("MANAGER_TOKEN=" + managerToken);
console.log("SP_TOKEN=" + spToken);
console.log("SP_NOLINK_TOKEN=" + spNoLinkToken);
