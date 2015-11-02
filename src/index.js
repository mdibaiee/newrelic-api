import unirest from 'unirest';
import qs from 'qs';

const API = 'https://api.newrelic.com/v2/';
export default class Client {
  /**
   * Create a new newrelic client instance
   * @param  {Object} options newrelic options:
   *                          - key: rest api key
   */
  constructor(options = {}) {
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
    let { app } = params;
    return this.call(`applications/${app}.json`, params).then(response => {
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
   * Average error rate
   * @param  {Object} params
   * @return {Promise}
   */
  error(params = {}) {
    params.summarize = true;
    params.names = ['Errors/all', 'HttpDispatcher', 'OtherTransaction/all'];
    return this.metrics(params).then(response => {
      let errors = response.metrics.find(i => i.name === 'Errors/all');
      let ot = response.metrics.find(i => i.name === 'OtherTransaction/all');
      let hd = response.metrics.find(i => i.name === 'HttpDispatcher');

      let errorCount = errors.timeslices[0].values.error_count;
      let otcc = ot.timeslices[0].values.call_count;
      let hdcc = hd.timeslices[0].values.call_count;

      if (errorCount === 0 || otcc + hdcc === 0) return 0;

      return 100 * errorCount / (otcc + hdcc);
    });
  }

  /**
   * Average apdex score
   * @param  {Object} params
   * @return {Promise}
   */
  apdex(params = {}) {
    params.summarize = true;
    params.names = ['Apdex', 'EndUser/Apdex'];

    return this.metrics(params).then(response => {
      let apdex = response.metrics.find(i => i.name === 'Apdex');
      let enduser = response.metrics.find(i => i.name === 'EndUser/Apdex');

      return {
        apdex: apdex.timeslices[0].score,
        enduser: enduser.timeslices[0].score,
        average: (apdex.timeslices[0] + enduser.timeslices[0].score) / 2
      };
    })
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
    let request = unirest.get(url).header('X-Api-Key', this.key);

    for (let key of Object.keys(params)) {
      if (Array.isArray(params[key])) {
        params[key].forEach(el => {
          request.query(key + '[]=' + el);
        });

        delete params[key];
      }
    }
    request.query(params);

    return new Promise((resolve, reject) => {
      request.end(response => {
        if (response.error) reject(response.error);
        else resolve(response.body);
      });
    })
  }
}
