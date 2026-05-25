module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath:
          'import com.backgroundlocation.BackgroundLocationPackage;',
      },
      ios: {
        podspecPath: './BackgroundLocation.podspec',
      },
    },
  },
};
