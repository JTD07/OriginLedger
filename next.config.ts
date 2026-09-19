import type { NextConfig } from "next";
import { getPublicEnv } from "./src/env/public";

getPublicEnv();

const nextConfig: NextConfig = {};

export default nextConfig;
