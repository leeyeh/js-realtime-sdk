/* eslint-disable */
module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);
  var nodeResolve = require('rollup-plugin-node-resolve');
  var json = require('rollup-plugin-json');
  var babel = require('rollup-plugin-babel');
  var commonjs = require('rollup-plugin-commonjs');
  var istanbul = require('rollup-plugin-istanbul');

  var env = function () {
    var envString = JSON.stringify(process.env);
    return {
      intro() {
        return `
window.process = window.process || {};
process.env = process.env || {};`;
      }
    };
  };
  var commonjsGlobal = function () {
    return {
      intro() {
        return `
var global = typeof window !== 'undefined' ? window :
             typeof global !== 'undefined' ? global :
             this;
var require = require || function(id) {throw new Error('Unexpected required ' + id)};
`;
      }
    };
  };

  var SAUCE_BROWSERS = [{
  //  browserName: 'chrome'
  //}, {
  //  browserName: 'firefox',
  //  version: 'beta'
  //}, {
  //  browserName: 'iPhone',
  //  version: '8.0'
  //}, {
  //  browserName: 'android',
  //  version: '4.4'
  //}, {
    browserName: 'internet explorer',
    version: '10.0'
  //}, {
  //  browserName: 'chrome',
  //  version: '31'
  }];

  var HINT_SRCS = ['src/**/*.js', 'test/**/*.js', /* 'demo/**\/*.js', */ '!**/browser/**/*.js', '!**/*.browser.js', '!**/*.bundle.js'];

  grunt.initConfig({
    watch: {
      scripts: {
        files: HINT_SRCS,
        tasks: ['build-test', 'release']
      },
    },
    eslint: {
      target: HINT_SRCS
    },
    rollup: {
      options: {
        sourceMap: true
      },
      dist: {
        dest: 'dist/bundle.js',
        src: 'src/realtime.js',
        options: {
          plugins: [
            json(),
            babel({ runtimeHelpers: true , exclude: 'node_modules/**' }),
            //nodeResolve({
            //  jsnext: true,
            //  main: true,
            //  skip: ['memcpy'],
            //}),
            commonjs({
              //include: ['node_modules/**', 'proto/**'],
              include: ['proto/**'],
            })
          ],
          format: 'cjs'
        }
      },
      'dist-browser': {
        dest: 'dist/bundle.browser.js',
        src: 'src/realtime.js',
        options: {
          plugins: [
            json(),
            babel({ runtimeHelpers: true , exclude: 'node_modules/**' }),
            nodeResolve({
              jsnext: true,
              main: true,
              browser: true
            }),
            commonjsGlobal(),
            commonjs({
              include: ['node_modules/**', 'proto/**'],
            })
          ],
          format: 'umd',
          moduleName: 'AV.realtime'
        }
      },
      test: {
        dest: 'test/index.bundle.js',
        src: 'test/index.js',
        options: {
          plugins: [
            istanbul({
              exclude: ['test/*.js', 'proto/*.js', '*.json'],
              instrumenter: require('istanbul'),
              instrumenterConfig: {
                esModules: true,
                noCompact: true,
              }
            }),
            json(),
            babel({ runtimeHelpers: true , exclude: 'node_modules/**' }),
            commonjs({
              include: ['proto/**'],
            }),
          ],
          format: 'cjs'
        }
      },
      'test-browser': {
        dest: 'test/browser/index.js',
        src: 'test/index.js',
        options: {
          plugins: [
            json(),
            babel({ runtimeHelpers: true , exclude: 'node_modules/**' }),
            nodeResolve({
              jsnext: true,
              main: true,
              browser: true
            }),
            commonjsGlobal(),
            commonjs({
              include: ['node_modules/**', 'proto/**'],
            }),
            env()
          ],
          format: 'umd',
          moduleName: 'AV.realtime'
        }
      }
    },
    envify: {
      'test-browser': {
        files: {
          'test/browser/index.env.js': ['test/browser/index.js']
        }
      }
    },
    uglify: {
      browser: {
        options: {
          sourceMap: true,
          sourceMapIn: 'dist/bundle.browser.js.map'
        },
        files: {
          'dist/bundle.browser.min.js': ['dist/bundle.browser.js']
        }
      }
    },
    mochaTest: {
      options: {
        timeout: 30000,
      },
      src: ['test/index.bundle.js']
    },
    storeCoverage: {
      options: {
        dir: 'coverage'
      }
    },
    connect: {
      server: {
        options: {
          port: 8000,
          base: ''
        }
      }
    },
    'mocha_phantomjs': {
      all: {
        options: {
          urls: [
            'http://localhost:8000/test/browser/'
          ]
        }
      }
    },
    'saucelabs-mocha': {
      all: {
        options: {
          urls: ['http://localhost:8000/test/browser/'],
          build: process.env.CI_BUILD_NUMBER,
          testname: 'Sauce Test for LeanCloud realtime SDK',
          browsers: SAUCE_BROWSERS,
          throttled: 5,
          tunnelArgs: ['--vm-version', 'dev-varnish']
        }
      }
    }
  });
  grunt.registerTask('default', []);
  grunt.registerTask('lint', ['eslint']);
  grunt.registerTask('build-test', ['rollup:test', 'rollup:test-browser', 'envify:test-browser']);
  grunt.registerTask('test', '', function() {
    var tasks = ['lint', 'build-test', /*'mocha_phantomjs',*/ 'mochaTest', 'storeCoverage'];
    if (process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY) {
      tasks = tasks.concat(['connect', 'saucelabs-mocha']);
    } else {
      grunt.log.writeln('Skip saucelabs test, set SAUCE_USERNAME and SAUCE_ACCESS_KEY to start it.');
    }
    grunt.task.run(tasks);
  });
  grunt.registerTask('release', ['rollup:dist-browser', 'rollup:dist', 'uglify:browser']);
  grunt.registerTask('dev', ['build-test', 'release', 'connect', 'watch']);
  grunt.registerTask('cdn', 'Upload dist to CDN.', function() {

    grunt.task.requires('release');
    var done = this.async();
    var version = require('./package.json').version;
    uploadCDN('./dist/AV.realtime.js', version, function() {
      uploadCDN('./dist/AV.realtime.min.js', version, done);
    });
  });
  grunt.registerTask('upload', ['release', 'cdn']);

  var qiniu = require('qiniu');
  var path = require('path');
  var fs = require('fs');

  qiniu.conf.ACCESS_KEY = process.env.CDN_QINIU_KEY;
  qiniu.conf.SECRET_KEY = process.env.CDN_QINIU_SECRET;

  function uploadCDN(file, version, cb) {
    var bucketname = 'paas_files';
    var key = 'static/js/' + path.basename(file, '.js') + '-' +
      version + '.js';
    var putPolicy = new qiniu.rs.PutPolicy(bucketname + ':' + key);
    var uptoken = putPolicy.token();
    var extra = new qiniu.io.PutExtra();
    extra.mimeType = 'application/javascript';
    var buffer = fs.readFileSync(file);
    qiniu.io.put(uptoken, key, buffer, extra, function(err, ret) {
      if (!err) {
        console.log('https://cdn1.lncld.net/' + ret.key);
      } else {
        console.log(err);
      }
      cb();
    });
  }

};
