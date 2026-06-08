@echo off
cd /d "C:\Users\mxz\Desktop\my website\aim-platform\worker"
"C:\Users\mxz\AppData\Local\Programs\Python\Python311\Scripts\uvicorn.exe" main:app --host 0.0.0.0 --port 8000
