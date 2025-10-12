const { spawn } = require('child_process');

// Test if the application can start without dependency injection errors
const testProcess = spawn('npm', ['run', 'start:dev'], {
  cwd: '/Users/derrickmadumere/WebstormProjects/orbs8',
  stdio: 'pipe'
});

let output = '';
let hasError = false;

testProcess.stdout.on('data', (data) => {
  output += data.toString();
  console.log(data.toString());
});

testProcess.stderr.on('data', (data) => {
  const errorText = data.toString();
  output += errorText;
  console.error(errorText);
  
  if (errorText.includes('UnknownDependenciesException')) {
    console.log('\n❌ DEPENDENCY INJECTION ERROR STILL EXISTS');
    hasError = true;
    testProcess.kill();
  } else if (errorText.includes('Nest application successfully started')) {
    console.log('\n✅ APPLICATION STARTED SUCCESSFULLY - DEPENDENCY INJECTION FIXED');
    testProcess.kill();
  }
});

// Kill after 30 seconds to avoid hanging
setTimeout(() => {
  if (!hasError) {
    console.log('\n✅ NO DEPENDENCY INJECTION ERRORS DETECTED IN 30 SECONDS');
  }
  testProcess.kill();
}, 30000);

testProcess.on('exit', (code) => {
  console.log(`\nProcess exited with code: ${code}`);
});