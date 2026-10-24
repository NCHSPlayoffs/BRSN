const fs=require('node:fs/promises');
const path=require('node:path');
const file=path.join(__dirname,'data','whiteboard-design.json');
async function readDesign(){
  try{return JSON.parse(await fs.readFile(file,'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}
async function saveDesign(input){
  const design={};
  for(const group of ['card','layout','stats']){
    const values=input?.[group];
    if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('Missing design group: '+group);
    design[group]={};
    for(const [key,value]of Object.entries(values)){
      if(!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(key)||['constructor','prototype','__proto__'].includes(key))throw new Error('Invalid design key');
      if(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=10000)design[group][key]=value;
      else if(typeof value==='string'&&value.length<=80)design[group][key]=value;
      else throw new Error('Invalid design value');
    }
  }
  design.savedAt=new Date().toISOString();
  await fs.mkdir(path.dirname(file),{recursive:true});
  const temp=file+'.'+require('node:crypto').randomUUID()+'.tmp';
  await fs.writeFile(temp,JSON.stringify(design,null,2));
  await fs.rename(temp,file);
  return design;
}
module.exports={readDesign,saveDesign};
