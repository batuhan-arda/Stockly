@echo off
echo Building Angular application...

rem Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"
set "CLIENT_DIR=%SCRIPT_DIR%clientapp"
set "WWWROOT_DIR=%SCRIPT_DIR%dotnetproject\wwwroot"
set "DIST_DIR=%CLIENT_DIR%\dist\clientapp"

cd /d "%CLIENT_DIR%"

echo Building for production...
call ng build --configuration production

echo Checking if build was successful...
if exist "%DIST_DIR%\browser\index.html" (
    echo Build successful! Copying files to wwwroot...
    
    rem Clear the wwwroot directory
    powershell -Command "Remove-Item '%WWWROOT_DIR%\*' -Recurse -Force -ErrorAction SilentlyContinue"
    
    rem Copy all contents from the browser folder to wwwroot
    echo Copying browser folder contents...
    powershell -Command "Copy-Item '%DIST_DIR%\browser\*' '%WWWROOT_DIR%\' -Recurse -Force"
    
    rem Copy additional files from dist/clientapp root
    echo Copying additional files...
    powershell -Command "Copy-Item '%DIST_DIR%\3rdpartylicenses.txt' '%WWWROOT_DIR%\' -Force -ErrorAction SilentlyContinue"
    powershell -Command "Copy-Item '%DIST_DIR%\prerendered-routes.json' '%WWWROOT_DIR%\' -Force -ErrorAction SilentlyContinue"
    
) else (
    echo Build failed! Please check for errors above.
)

pause
