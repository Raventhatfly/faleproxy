/**
 * @jest-environment node
 */

const request = require('supertest');
const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');

// We need to require the app after setting up nock
let app;

describe('Integration Tests', () => {
  beforeAll(() => {
    // Suppress console.error during tests to avoid CI/CD failures
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock external HTTP requests
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
    
    // Load the Express app (without starting the server)
    app = require('../app');
  });

  beforeEach(() => {
    // Clean up any pending mocks before each test
    nock.cleanAll();
  });

  afterAll(() => {
    // Restore console.error
    console.error.mockRestore();
    
    // Clean up nock
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Setup mock for example.com
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);
    
    // Make a request to our proxy app using supertest
    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/' })
      .expect(200);
    
    const data = response.body;
    expect(data.success).toBe(true);
    
    // Verify Yale has been replaced with Fale in text
    const $ = cheerio.load(data.content);
    const titleText = $('title').text();
    const h1Text = $('h1').text();
    const pText = $('p').first().text();
    const firstLinkText = $('a').first().text();
    
    expect(titleText).toBe('Fale University Test Page');
    expect(h1Text).toBe('Welcome to Fale University');
    expect(pText).toContain('Fale University is a private');
    
    // Verify URLs remain unchanged
    let hasYaleUrl = false;
    $('a').each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);
    
    // Verify link text is changed
    expect(firstLinkText).toBe('About Fale');
  });

  test('Should handle invalid URLs', async () => {
    await request(app)
      .post('/fetch')
      .send({ url: 'not-a-valid-url' })
      .expect(500);
  });

  test('Should handle missing URL parameter', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({})
      .expect(400);
    
    expect(response.body.error).toBe('URL is required');
  });
});
