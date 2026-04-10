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

module.exports = {
  entry: {
    popup: "./src/index.tsx",
    background: "./src/background.ts",
    contentScript: "./src/contentScript.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  module: {
    rules: [
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
          filename: "assets/images/[name][ext]",
        },
      },
      // Font handling
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
        generator: {
          filename: "assets/fonts/[name][ext]",
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      filename: "index.html",
      chunks: ["popup"],
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
    new webpack.DefinePlugin({
      "process.env.FIREBASE_API_KEY": JSON.stringify(
        firebaseEnv.FIREBASE_API_KEY,
      ),
      "process.env.FIREBASE_AUTH_DOMAIN": JSON.stringify(
        firebaseEnv.FIREBASE_AUTH_DOMAIN,
      ),
      "process.env.FIREBASE_PROJECT_ID": JSON.stringify(
        firebaseEnv.FIREBASE_PROJECT_ID,
      ),
      "process.env.FIREBASE_STORAGE_BUCKET": JSON.stringify(
        firebaseEnv.FIREBASE_STORAGE_BUCKET,
      ),
      "process.env.FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(
        firebaseEnv.FIREBASE_MESSAGING_SENDER_ID,
      ),
      "process.env.FIREBASE_APP_ID": JSON.stringify(
        firebaseEnv.FIREBASE_APP_ID,
      ),
    }),
  ],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
};
