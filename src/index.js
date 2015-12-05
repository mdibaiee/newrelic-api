import unirest from 'unirest';
import qs from 'qs';

const API = 'https://api.newrelic.com/v2/';
export default class Client {
  /**
   * Create a new newrelic client instance
   * @param  {Object} options newrelic options:
   *                          - key: rest api key
   */
  constructor(options) {
    Object.assign(this, options);
  }

  /**
   * List applications
   * @param  {Object} params
   * @return {Promise}       list of applications
   */
  apps(params = {}) {
    return this.call('applications.json', params).then(response => {
      return response.applications;
    });
  }

  /**
   * Application's details
   * @param  {Object} params
   * @return {Promise}
   */
  app(params = {}) {
    let id = params.app;
    return this.call(`applications/${id}.json`, params).then(response => {
      return response.application;
    });
  }

  /**
   * Metrics
   * @param  {Object} params
   * @return {Promise}
   */
  metrics(params = {}) {
    let {host, instance, app} = params;
    let id;
    if (params.host) id = `/hosts/${host}`;
    else if (params.instance) id = `/instances/${instance}`;
    else id = '';

    // defaults to (15 minutes ago - now)
    let d = new Date();
    let fifteen = 1000 * 50 * 15;
    let from = new Date(d - fifteen);
    params.from = from.toISOString();

    const url = `applications/${app}${id}/metrics/data.json`;
    return this.call(url, params)
    .then(response => {
      return response.metric_data;
    });
  }

  /**
   * Error rate
   * @param  {Object} params
   * @return {Promise}
   */
  async error(params = {}) {
    params.names = ['Errors/all', 'HttpDispatcher', 'OtherTransaction/all'];

    let response = await this.metrics(params)
    let errors = response.metrics.find(i => i.name === 'Errors/all');
    let otherTransaction = response.metrics.find(i => i.name === 'OtherTransaction/all');
    let httpDispatcher = response.metrics.find(i => i.name === 'HttpDispatcher');

    return {
      errors, otherTransaction, httpDispatcher
    }
  }

  /**
   * Takes error, otherTransaction and httpDispatcher timeslices and returns
   * the average error rate
   * @param  {Timeslice} error
   * @param  {Timeslice} otherTransacation
   * @param  {Timeslice} httpDispatcher
   * @return {Number}
   */
  averageError(error, otherTransaction, httpDispatcher) {
    let errorCount = error.values.error_count;
    let otcc = otherTransaction.values.call_count;
    let hdcc = httpDispatcher.values.call_count;

    if (errorCount === 0 || otcc + hdcc === 0) return 0;

    return 100 * errorCount / (otcc + hdcc);
  }

  /**
   * Apdex score
   * @param  {Object} params
   * @return {Promise}
   */
  async apdex(params = {}) {
    params.names = ['Apdex', 'EndUser/Apdex'];

    let response = await this.metrics(params);

    let apdex = response.metrics.find(i => i.name === 'Apdex');
    let enduser = response.metrics.find(i => i.name === 'EndUser/Apdex');

    return {
      apdex, enduser
    };
  }

  /**
   * Takes apdex and enduser timeslices and returns average apdex score
   * @param  {Timeslice} apdex
   * @param  {Timeslice} enduser
   * @return {Number}
   */
  averageApdex(apdex, enduser) {
    return (apdex.values.score + enduser.values.score) / 2;
  }

  /**
   * Calls a request to newrelic API for the specified method with given
   * parameters
   * @param  {String} method API method
   *                         e.g. applications/${APP}/metrics/data.json
   * @param  {Object} params extra parameters passed as query
   * @return {Promise}
   */
  call(method, params = {}) {
    let url = API + method;
    let request = unirest.get(url)
                  .header('X-Api-Key', this.key)
                  .query(qs.stringify(params, { arrayFormat: 'brackets' }));

    return new Promise((resolve, reject) => {
      request.end(response => {
        if (response.error) reject(response.error);
        else resolve(response.body);
      });
    })
  }
}
