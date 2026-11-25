/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFiles: ["<rootDir>/tests/setup-env.ts"],
  globalSetup: "<rootDir>/tests/global-setup.ts",
  transform: {
    // Transpile only (type checking runs separately with `npm run typecheck`), and compile to
    // CommonJS so Jest can load the generated Prisma client's dynamic imports.
    "^.+\\.ts$": ["ts-jest", { tsconfig: { module: "commonjs", moduleResolution: "node", isolatedModules: true } }],
  },
  testTimeout: 20000,
};
