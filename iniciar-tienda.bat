@echo off
chcp 65001 >nul
title BADCAKE — Servidor Local
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
