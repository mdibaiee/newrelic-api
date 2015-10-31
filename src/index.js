import unirest from 'unirest';
import qs from 'qs';

const API = 'https://api.newrelic.com/v2/';
export default class Client {
  /**
   * Create a new newrelic client instance
   * @param  {Object} options newrelic options:
   *                          - key: rest api key
   *                          - app: application id
   *                          - host: host id
   *                          - instance: instance id
   */
  constructor(options = {}) {
    Object.assign(this, options);
  }

  /**
   * List applications
   * @param  {Object} params
   * @return {Promise}       list of applications
   */
  list(params = {}) {
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
    return this.call('applications/${APP}.json', params).then(response => {
      return response.application;
    });
  }

  /**
   * Metrics
   * @param  {Object} params
   * @return {Promise}
   */
  metrics(params = {}) {
    let id = this.host ? '${HOST}' : '${INSTANCE}';

    // defaults to (15 minutes ago - now)
    let d = new Date();
    let fifteen = 1000 * 50 * 15;
    let from = new Date(d - fifteen);
    params.from = from.toISOString();

    const url = 'applications/${APP}/hosts/' + id + '/metrics/data.json';
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
   * Calls a request to newrelic API for the specified method with given
   * parameters
   * @param  {String} method API method
   *                         e.g. applications/${APP}/metrics/data.json
   * @param  {Object} params extra parameters passed as query
   * @return {Promise}
   */
  call(method, params = {}) {
    method = method.replace('${APP}', this.app)
                   .replace('${HOST}', this.host)
                   .replace('${INSTANCE}', this.instance);

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
        console.log('response', response.body);
        if (response.error) reject(response.error);
        else resolve(response.body);
      });
    })
  }
}
