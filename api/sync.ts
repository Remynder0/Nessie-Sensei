import { put, list } from '@vercel/blob';

export default async function handler(req: any, res: any) {
  // Allow CORS if necessary
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ensure Blob token is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob database is not configured on Vercel.' });
  }

  try {
    if (req.method === 'POST') {
      const { code, data } = req.body;
      if (!code || !data) {
        return res.status(400).json({ error: 'Missing code or data' });
      }
      
      // Store data in Blob using the sync code as filename
      await put(`sync_${code}.json`, data, { 
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json'
      });
      
      return res.status(200).json({ success: true });
    } 
    
    else if (req.method === 'GET') {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ error: 'Missing code' });
      }
      
      // Find the blob
      const { blobs } = await list({ prefix: `sync_${code}.json` });
      
      if (blobs.length === 0) {
        return res.status(404).json({ error: 'Code not found or no data' });
      }
      
      // Fetch the actual data from the blob URL
      const response = await fetch(blobs[0].url);
      const data = await response.text();
      
      return res.status(200).json({ success: true, data });
    } 
    
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Blob Sync Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
