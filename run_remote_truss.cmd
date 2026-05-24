@echo off
setlocal

set URL=%~1
if "%URL%"=="" set URL=http://192.168.60.104:8451/api/problem

node "%~dp0solve_remote_truss.js" "%URL%"
endlocal
