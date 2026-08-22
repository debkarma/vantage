import { filterNoise } from '../src/engine/noiseFilter.js';

const expectedBody = {
  id: 1,
  created_at: '2026-08-22T14:49:03.902110Z',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJkZWJAZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsImV4cCI6MTc4ODAxNDk1NH0.AUYVnaKIIEDsHnam0eF9dbeVWtzhZLqWAP7LX-jWLyI',
  nested: {
    uuid: '123e4567-e89b-12d3-a456-426614174000'
  }
};

const actualBody = {
  id: 1,
  created_at: '2026-08-22T14:51:12.699781Z',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJkZWJAZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsImV4cCI6MTc4ODAxNTA3Mn0.2uqjAitbiTxMk3Y8TeUrUPbgwOi4BsM_x1LdDiJ8aXc',
  nested: {
    uuid: '987e6543-e21b-12d3-a456-426614174000'
  }
};

const result = filterNoise(expectedBody, actualBody, {}, {}, { headers: [], body_fields: [], smart_masking: true });
console.log(JSON.stringify(result.filteredExpectedBody, null, 2));
console.log(JSON.stringify(result.filteredActualBody, null, 2));
