'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _unirest = require('unirest');

var _unirest2 = _interopRequireDefault(_unirest);

var _qs = require('qs');

var _qs2 = _interopRequireDefault(_qs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var API = 'https://api.newrelic.com/v2/';

var Client = (function () {
  /**
   * Create a new newrelic client instance
   * @param  {Object} options newrelic options:
   *                          - key: rest api key
   */

  function Client(options) {
    _classCallCheck(this, Client);

    Object.assign(this, options);
  }

  /**
   * List applications
   * @param  {Object} params
   * @return {Promise}       list of applications
   */

  _createClass(Client, [{
    key: 'apps',
    value: function apps() {
      var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return this.call('applications.json', params).then(function (response) {
        return response.applications;
      });
    }

    /**
     * Application's details
     * @param  {Object} params
     * @return {Promise}
     */

  }, {
    key: 'app',
    value: function app() {
      var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var id = params.app;
      return this.call('applications/' + id + '.json', params).then(function (response) {
        return response.application;
      });
    }

    /**
     * Metrics
     * @param  {Object} params
     * @return {Promise}
     */

  }, {
    key: 'metrics',
    value: function metrics() {
      var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
      var host = params.host;
      var instance = params.instance;
      var app = params.app;

      var id = undefined;
      if (params.host) id = '/hosts/' + host;else if (params.instance) id = '/instances/' + instance;else id = '';

      // defaults to (15 minutes ago - now)
      var d = new Date();
      var fifteen = 1000 * 50 * 15;
      var from = new Date(d - fifteen);
      params.from = from.toISOString();

      var url = 'applications/' + app + id + '/metrics/data.json';
      return this.call(url, params).then(function (response) {
        return response.metric_data;
      });
    }

    /**
     * Average error rate
     * @param  {Object} params
     * @return {Promise}
     */

  }, {
    key: 'error',
    value: function error() {
      var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      params.summarize = true;
      params.names = ['Errors/all', 'HttpDispatcher', 'OtherTransaction/all'];
      return this.metrics(params).then(function (response) {
        var errors = response.metrics.find(function (i) {
          return i.name === 'Errors/all';
        });
        var ot = response.metrics.find(function (i) {
          return i.name === 'OtherTransaction/all';
        });
        var hd = response.metrics.find(function (i) {
          return i.name === 'HttpDispatcher';
        });

        var errorCount = errors.timeslices[0].values.error_count;
        var otcc = ot.timeslices[0].values.call_count;
        var hdcc = hd.timeslices[0].values.call_count;

        if (errorCount === 0 || otcc + hdcc === 0) return 0;

        return 100 * errorCount / (otcc + hdcc);
      });
    }

    /**
     * Average apdex score
     * @param  {Object} params
     * @return {Promise}
     */

  }, {
    key: 'apdex',
    value: (function (_apdex) {
      function apdex() {
        return _apdex.apply(this, arguments);
      }

      apdex.toString = function () {
        return _apdex.toString();
      };

      return apdex;
    })(function () {
      var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      params.summarize = true;
      params.names = ['Apdex', 'EndUser/Apdex'];

      return this.metrics(params).then(function (response) {
        var result = response.metrics.find(function (i) {
          return i.name === 'Apdex';
        });
        var enduser = response.metrics.find(function (i) {
          return i.name === 'EndUser/Apdex';
        });

        return {
          apdex: result.timeslices[0].score,
          enduser: enduser.timeslices[0].score,
          average: (apdex.timeslices[0] + enduser.timeslices[0].score) / 2
        };
      });
    })

    /**
     * Calls a request to newrelic API for the specified method with given
     * parameters
     * @param  {String} method API method
     *                         e.g. applications/${APP}/metrics/data.json
     * @param  {Object} params extra parameters passed as query
     * @return {Promise}
     */

  }, {
    key: 'call',
    value: function call(method) {
      var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var url = API + method;
      var request = _unirest2.default.get(url).header('X-Api-Key', this.key);

      // for (let key of Object.keys(params)) {
      //   if (Array.isArray(params[key])) {
      //     params[key].forEach(el => {
      //       request.query(key + '[]=' + el);
      //     });
      //
      //     delete params[key];
      //   }
      // }
      request.query(_qs2.default.stringify(params));

      return new Promise(function (resolve, reject) {
        request.end(function (response) {
          if (response.error) reject(response.error);else resolve(response.body);
        });
      });
    }
  }]);

  return Client;
})();

exports.default = Client;
