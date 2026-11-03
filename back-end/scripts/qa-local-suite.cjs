const {spawn}=require('node:child_process');
require('dotenv').config({quiet:true});
const url=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Banco não local');
url.pathname='/pcp_workflow_test';
const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','--maxWorkers=1','--testTimeout=15000','--reporter=dot'],{
 stdio:'inherit',windowsHide:true,
 env:{...process.env,DATABASE_URL:url.toString(),WORKFLOW_TEST_DATABASE_URL:url.toString(),NO_COLOR:'1'},
});
child.on('exit',code=>{process.exitCode=code??1});
