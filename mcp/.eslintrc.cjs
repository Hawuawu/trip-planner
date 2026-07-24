module.exports = {
  ...require('../eslint.node-subproject.cjs'),
  overrides: [
    {
      files: ['src/auth/filePersistence.ts'],
      rules: {
        // credentialsFile is built entirely from os.homedir() + hardcoded
        // literal path segments (see config.ts) — never from user/network
        // input. This is exactly the ~/.aws/credentials-style local
        // session-cache pattern the rule can't distinguish from a real
        // path-traversal risk; scoped off here rather than globally.
        'security/detect-non-literal-fs-filename': 'off',
      },
    },
  ],
};
