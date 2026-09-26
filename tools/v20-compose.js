#!/usr/bin/env node
'use strict';
// Compose trusted, local JavaScript patches without rewriting the v19 source.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const zlib = require('node:zlib');
const ANCHOR = '// ---- js/main.js ----';
const MARKER = '// ---- v20 composed extensions ----';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function fail(message) { throw new Error(message); }
function canonical(file) {
  const resolved = path.resolve(file);
  return fs.existsSync(resolved) ? fs.realpathSync(resolved) : path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
}
function compose(baseFile, manifestFile) {
  const baseBytes = fs.readFileSync(baseFile);
  const bytes = baseFile.endsWith('.gz') ? zlib.gunzipSync(baseBytes) : baseBytes;
  const originalHtml = bytes.toString('utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.patches) || !manifest.patches.length) fail('Manifest needs version: 1 and a nonempty patches array');
  const baseSha256 = sha(bytes);
  if (manifest.baseSha256 && manifest.baseSha256 !== baseSha256) fail('Base SHA-256 does not match manifest');
  if (originalHtml.includes(MARKER)) fail('Input is already composed; use the original v19');
  let html=originalHtml;
  const chapterFile=manifest.chapter ? path.resolve(path.dirname(manifestFile),manifest.chapter) : null;
  const chapterHelper=chapterFile ? path.resolve(__dirname,'v20-chapter-extension.cjs') : null;
  let chapterReport;
  if(chapterFile){
    const chapter=JSON.parse(fs.readFileSync(chapterFile,'utf8'));
    html=require(chapterHelper).extendChapter(html,chapter);
    chapterReport={id:chapter.id,sha256:sha(Buffer.from(JSON.stringify(chapter)))};
  }
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  if (scripts.length !== 1) fail('Expected exactly one v19 inline script');
  const source = scripts[0][1];
  if (source.split(ANCHOR).length !== 2 || html.split(ANCHOR).length !== 2) fail('Expected one main.js insertion anchor');
  for (const signature of ['class Game ', 'const HEROES =', '// ---- js/arena-craft-v19.js ----']) {
    if (!source.includes(signature)) fail('Unsupported base: missing ' + signature);
  }
  const ids = new Set(), inputFiles = [baseFile, manifestFile,...(chapterFile?[chapterFile,chapterHelper]:[])], modules = [];
  for (const entry of manifest.patches) {
    if (!entry || !/^[a-z][a-z0-9-]*$/.test(entry.id) || ids.has(entry.id)) fail('Patch IDs must be unique lowercase slugs');
    if (typeof entry.file !== 'string' || !entry.file) fail('Patch file is required for ' + entry.id);
    if (entry.after !== undefined && !Array.isArray(entry.after)) fail('after must be an array for ' + entry.id);
    for (const dependency of entry.after || []) if (!ids.has(dependency)) fail(entry.id + ' requires earlier patch ' + dependency);
    const file = path.resolve(path.dirname(manifestFile), entry.file);
    const code = fs.readFileSync(file, 'utf8');
    if (/<\/script\b/i.test(code)) fail('Patch contains an HTML script terminator: ' + entry.id);
    new vm.Script(code, {filename: file});
    modules.push({id:entry.id, code, sha256:sha(Buffer.from(code))});
    inputFiles.push(file); ids.add(entry.id);
  }
  const report = {version:20, baseSha256,...(chapterReport?{chapter:chapterReport}:{}), patches:modules.map(({id,sha256}) => ({id,sha256}))};
  const additions = [MARKER,
    'window.V20Build = ' + JSON.stringify({...report, installed:[]}) + ';',
    ...modules.map(m => '\n// v20 patch: ' + m.id + '\n' + m.code + '\n;window.V20Build.installed.push(' + JSON.stringify(m.id) + ');'),
    '// ---- end v20 composed extensions ----\n'];
  const block = additions.join('\n');
  // Validate in the real lexical scope too: independent parsing misses conflicts
  // with existing top-level const/class declarations and preceding patch files.
  new vm.Script(source.replace(ANCHOR, block + ANCHOR), {filename:'v20-composed-inline.js'});
  const output = html.replace(ANCHOR, block + ANCHOR);
  return {html:output, inputFiles, report:{...report, outputSha256:sha(Buffer.from(output)), outputBytes:Buffer.byteLength(output)}};
}
function main(argv) {
  const args = {};
  for (let i=0;i<argv.length;i++) {
    const name=argv[i];
    if (name === '--check') args.check=true;
    else if (['--base','--manifest','--out'].includes(name) && argv[i+1] && !argv[i+1].startsWith('--')) args[name.slice(2)]=argv[++i];
    else fail('Unknown or incomplete argument: ' + name);
  }
  if (!args.base || !args.manifest || (!args.out && !args.check)) fail('Usage: node tools/v20-compose.js --base original.html[.gz] --manifest patches.json --out candidate.html[.gz] [--check]');
  const result=compose(path.resolve(args.base), path.resolve(args.manifest));
  if (args.out) {
    const output=canonical(args.out);
    if (result.inputFiles.some(file=>canonical(file)===output)) fail('Output must not overwrite any input file');
    if (!args.check) {
      const payload=args.out.endsWith('.gz') ? zlib.gzipSync(result.html,{level:9}) : result.html;
      const temp=output+'.tmp-'+process.pid;
      try { fs.writeFileSync(temp,payload,{flag:'wx'}); fs.renameSync(temp,output); }
      finally { if(fs.existsSync(temp)) fs.unlinkSync(temp); }
    }
  }
  console.log(JSON.stringify({...result.report,checkedOnly:!!args.check},null,2));
}
if (require.main===module) { try {main(process.argv.slice(2));} catch(error) {console.error('v20-compose: '+error.message);process.exitCode=1;} }
module.exports={compose};
