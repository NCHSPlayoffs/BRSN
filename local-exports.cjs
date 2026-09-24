const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
module.exports = function localExports(root, chooseDirectory) {
  const file = path.join(root, 'data', 'export-directories.json');
  const sports = new Set(['football','baseball','softball','volleyball','boys','girls','boys_soccer','girls_soccer']);
  const batches = new Map();
  const read = () => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const pick = chooseDirectory || (async () => {
    if (process.platform !== 'win32') throw new Error('Folder browsing requires the local Windows server.');
    const { stdout } = await run('powershell.exe', ['-NoProfile', '-STA', '-Command', "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Choose the default export folder for this sport'; if($d.ShowDialog() -eq 'OK'){[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; [Console]::Write($d.SelectedPath)}"], { windowsHide: true });
    return stdout.trim();
  });
  return async (req, res, url) => {
    if (!url.pathname.startsWith('/local-exports/')) return false;
    const reply = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); return true; };
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || (req.headers.origin && req.headers.origin !== url.origin) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403,{error:'Local access only'});
    try {
      if (req.method === 'GET' && url.pathname === '/local-exports/settings') return reply(200,{directories:read()});
      const sport = url.searchParams.get('sport');
      if (!sports.has(sport) || req.method !== 'POST') return reply(400,{error:'Invalid sport or method'});
      if (url.pathname === '/local-exports/browse') {
        const directory = await pick();
        if (!directory) return reply(200,{cancelled:true});
        if (!path.isAbsolute(directory) || !fs.statSync(directory).isDirectory()) throw new Error('Select an existing folder.');
        const directories = read(); directories[sport] = directory;
        fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(directories,null,2));
        return reply(200,{directories});
      }
      if (url.pathname !== '/local-exports/save') return reply(404,{error:'Not found'});
      const directory = read()[sport];
      if (!directory) throw new Error('Choose a folder for this sport first.');
      const batch = url.searchParams.get('batch');
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(batch || '')) throw new Error('Invalid export batch');
      const filename = url.searchParams.get('filename');
      if (!filename || filename.length > 180 || /[<>:"/\\|?*\x00-\x1f]/.test(filename) || !/\.(png|jpe?g)$/i.test(filename) || filename.startsWith('.')) throw new Error('Invalid image filename');
      const chunks=[];let size=0;
      for await (const chunk of req) {size+=chunk.length;if(size>52428800)return reply(413,{error:'PNG exceeds 50 MB'});chunks.push(chunk);}
      const png=Buffer.concat(chunks);
      const isPng = png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const isJpeg = png[0] === 255 && png[1] === 216 && png[2] === 255;
      if (/\.png$/i.test(filename) ? !isPng : !isJpeg) throw new Error('Image format does not match filename');
      const key=directory+'|'+sport+'|'+batch;
      let folder=batches.get(key);
      if(!folder){
        const now=new Date(); const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
        for(let version=1;;version++){
          folder=path.join(directory,date+(version===1?'':` v${version}`));
          try{fs.mkdirSync(folder);break}catch(error){if(error.code!=='EEXIST')throw error}
        }
        batches.set(key,folder);
      }
      let output;
      for(let version=1;;version++){
        output=path.join(folder,filename.replace(/\.(png|jpe?g)$/i,extension => (version===1?'':` (${version})`)+extension));
        try{fs.writeFileSync(output,png,{flag:'wx'});break}catch(error){if(error.code!=='EEXIST')throw error}
      }
      return reply(200,{path:output,folder});
    }catch(error){return reply(400,{error:error.message})}
  };
};
