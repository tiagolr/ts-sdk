import {HttpClient, HttpClientResponse} from "./HttpClient.js";
import {NodejsHttpClient} from "./NodejsHttpClient.js";

/**
 * Returns a default HttpClient implementation based on the environment that it is run on.
 */
export default function defaultHttpClient(): HttpClient {
    const noHttpClient:HttpClient = {
        fetch(..._): Promise<HttpClientResponse> {
            throw new Error('No method available to perform HTTP request')
        }
    }

    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        // Use fetch in a browser environment
        return window
    } else if (typeof require !== 'undefined') {
        // Use Node.js https module
        // eslint-disable-next-line
        try {
            const https = require('https')
            return new NodejsHttpClient(https)
        } catch (e) {
            return noHttpClient
        }
    } else {
        return noHttpClient
    }
}