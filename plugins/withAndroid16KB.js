const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroid16KB = (config) => {
    return withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application[0];

        // Add 16KB page size support
        if (!mainApplication['$']) {
            mainApplication['$'] = {};
        }

        mainApplication['$']['android:maxPageSize'] = '16384';

        return config;
    });
};

module.exports = withAndroid16KB;