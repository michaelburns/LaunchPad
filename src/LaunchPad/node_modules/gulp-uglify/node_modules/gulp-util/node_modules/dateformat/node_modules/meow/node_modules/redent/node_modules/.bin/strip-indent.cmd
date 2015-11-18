@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\strip-indent\cli.js" %*
) ELSE (
  node  "%~dp0\..\strip-indent\cli.js" %*
)