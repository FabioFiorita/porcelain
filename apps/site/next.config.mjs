import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Repository-owned AGENTS.md supplies contributor guidance.
  agentRules: false,
};

export default withMDX(config);
