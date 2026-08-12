const globals = require("globals");

module.exports = [
    {
        ignores: [
            "node_modules/**",
            "build/**",
            "dist/**",
            "app/routes/upgame-webhooks/**"
        ]
    },

    {
        files: ["**/*.js"],

        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                db: "writable",
                thisDb: "writable"
            }
        },

        rules: {
            "no-unused-vars": "warn",
            "no-undef": "error",
            "no-unreachable": "error"
        }
    }
];