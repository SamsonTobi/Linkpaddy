const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
require("dotenv").config();

const firebaseEnv = {
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || "",
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || "",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || "",
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || "",
};

const defineFirebaseEnv = () =>
  new webpack.DefinePlugin(
    Object.fromEntries(
      Object.entries(firebaseEnv).map(([key, value]) => [
        `process.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
  );

const sharedRules = (assetsDir) => [
  {
    test: /\.(js|jsx|ts|tsx)$/,
    exclude: /node_modules/,
    use: {
      loader: "ts-loader",
    },
  },
  {
    test: /\.css$/,
    use: ["style-loader", "css-loader", "postcss-loader"],
  },
  {
    test: /\.(png|jpe?g|gif|svg)$/i,
    type: "asset/resource",
    generator: {
      filename: `${assetsDir}/images/[name][ext]`,
    },
  },
  // Font handling
  {
    test: /\.(woff|woff2|eot|ttf|otf)$/i,
    type: "asset/resource",
    generator: {
      filename: `${assetsDir}/fonts/[name][ext]`,
    },
  },
];

// The browser extension, plus the marketing site served from the same bundle.
const extensionConfig = {
  name: "extension",
  entry: {
    popup: "./src/index.tsx",
    sidepanel: "./src/sidepanel.tsx",
    background: "./src/background.ts",
    contentScript: "./src/contentScript.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    // dist/app belongs to the web app config below.
    clean: { keep: /^app\// },
  },
  module: {
    rules: sharedRules("assets"),
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      filename: "index.html",
      chunks: ["popup"],
    }),
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      filename: "sidepanel.html",
      chunks: ["sidepanel"],
    }),
    new CopyPlugin({
      patterns: [
        { from: "public/manifest.json", to: "manifest.json" },
        { from: "public/_locales", to: "_locales" },
        { from: "public/privacy.html", to: "privacy.html" },
        { from: "public/icons", to: "icons" },
        {
          from: "public/google4e2e59a478b74072.html",
          to: "google4e2e59a478b74072.html",
        },
      ],
    }),
    defineFirebaseEnv(),
  ],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
};

// The installable web app, served at /app/. Same UI and data layer, with the
// full Firebase web SDK (popup/redirect sign-in) instead of the extension build.
const webAppConfig = {
  name: "webapp",
  entry: { app: "./src/webapp.tsx" },
  output: {
    path: path.resolve(__dirname, "dist/app"),
    publicPath: "/app/",
    filename: "[name].[contenthash:8].js",
    clean: true,
  },
  module: {
    rules: sharedRules("assets").map((rule) =>
      rule.generator
        ? {
            ...rule,
            generator: {
              filename: rule.generator.filename.replace("[name]", "[name].[contenthash:8]"),
            },
          }
        : rule,
    ),
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/app.html",
      filename: "index.html",
    }),
    new CopyPlugin({
      patterns: [
        { from: "public/pwa/manifest.webmanifest", to: "manifest.webmanifest" },
        { from: "public/pwa/icons", to: "icons" },
        {
          from: "public/pwa/sw.js",
          to: "sw.js",
          transform: (content) => content.toString().replace("__BUILD_ID__", Date.now().toString(36)),
        },
      ],
    }),
    defineFirebaseEnv(),
    // The shared data layer imports the extension build of Firebase Auth, which
    // has no popup sign-in. A resolver alias can't do this swap: enhanced-resolve
    // skips aliases whose target is a prefix of the request.
    new webpack.NormalModuleReplacementPlugin(
      /^firebase\/auth\/web-extension$/,
      "firebase/auth",
    ),
  ],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
};

module.exports = [extensionConfig, webAppConfig];
