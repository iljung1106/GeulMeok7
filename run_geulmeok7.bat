@echo off
echo ===================================================
echo GeulMeok7 소설 작성 도우미 시작하기
echo ===================================================
echo.

:: 필요한 디렉토리 생성
if not exist "data" mkdir data
if not exist "data\templates" mkdir data\templates

:: Python 설치 확인
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python이 설치되어 있지 않습니다.
    echo Python을 설치한 후 다시 시도해주세요. (https://www.python.org/downloads/)
    echo.
    pause
    exit /b
)

:: 필요한 패키지 설치
echo 필요한 패키지를 설치합니다...
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo 패키지 설치 중 오류가 발생했습니다.
    pause
    exit /b
)

echo.
echo 설치가 완료되었습니다.
echo.
echo ===================================================
echo GeulMeok7 소설 작성 도우미를 시작합니다...
echo.
echo 웹 브라우저에서 http://127.0.0.1:5000 으로 접속하세요.
echo 종료하려면 이 창에서 Ctrl+C를 누르세요.
echo ===================================================
echo.

:: 애플리케이션 실행
python app.py

pause
