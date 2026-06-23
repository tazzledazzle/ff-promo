@rem
@rem Copyright 2015 the original author or authors.
@rem
@rem Licensed under the Apache License, Version 2.0 (the "License");
@rem you may not use this file except in compliance with the License.
@rem You may obtain a copy of the License at
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@rem Unless required by applicable law or agreed to in writing, software
@rem distributed under the License is distributed on an "AS IS" BASIS,
@rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
@rem See the License for the specific language governing permissions and
@rem limitations under the License.
@rem
@rem SPDX-License-Identifier: Apache-2.0
@rem

@if "%DEBUG%"=="" @echo off
@rem ##########################################################################
@rem
@rem  worker startup script for Windows
@rem
@rem ##########################################################################

@rem Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
@rem This is normally unused
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%..

@rem Resolve any "." and ".." in APP_HOME to make it shorter.
for %%i in ("%APP_HOME%") do set APP_HOME=%%~fi

@rem Add default JVM options here. You can also use JAVA_OPTS and WORKER_OPTS to pass JVM options to this script.
set DEFAULT_JVM_OPTS=

@rem Find java.exe
if defined JAVA_HOME goto findJavaFromJavaHome

set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if %ERRORLEVEL% equ 0 goto execute

echo. 1>&2
echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH. 1>&2
echo. 1>&2
echo Please set the JAVA_HOME variable in your environment to match the 1>&2
echo location of your Java installation. 1>&2

goto fail

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%/bin/java.exe

if exist "%JAVA_EXE%" goto execute

echo. 1>&2
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME% 1>&2
echo. 1>&2
echo Please set the JAVA_HOME variable in your environment to match the 1>&2
echo location of your Java installation. 1>&2

goto fail

:execute
@rem Setup the command line

set CLASSPATH=%APP_HOME%\lib\worker-0.1.0-SNAPSHOT.jar;%APP_HOME%\lib\db-0.1.0-SNAPSHOT.jar;%APP_HOME%\lib\contracts-0.1.0-SNAPSHOT.jar;%APP_HOME%\lib\exposed-jdbc-0.56.0.jar;%APP_HOME%\lib\exposed-java-time-0.56.0.jar;%APP_HOME%\lib\exposed-json-0.56.0.jar;%APP_HOME%\lib\exposed-core-0.56.0.jar;%APP_HOME%\lib\kotlinx-serialization-core-jvm-1.8.0.jar;%APP_HOME%\lib\kotlinx-serialization-json-jvm-1.8.0.jar;%APP_HOME%\lib\kotlin-reflect-2.0.0.jar;%APP_HOME%\lib\kotlinx-coroutines-core-jvm-1.9.0.jar;%APP_HOME%\lib\kotlin-stdlib-2.1.10.jar;%APP_HOME%\lib\temporal-sdk-1.27.1.jar;%APP_HOME%\lib\annotations-23.0.0.jar;%APP_HOME%\lib\flyway-database-postgresql-11.3.4.jar;%APP_HOME%\lib\flyway-core-11.3.4.jar;%APP_HOME%\lib\postgresql-42.7.5.jar;%APP_HOME%\lib\HikariCP-6.2.1.jar;%APP_HOME%\lib\jnanoid-2.0.0.jar;%APP_HOME%\lib\temporal-serviceclient-1.27.1.jar;%APP_HOME%\lib\grpc-services-1.54.1.jar;%APP_HOME%\lib\protobuf-java-util-3.22.0.jar;%APP_HOME%\lib\grpc-stub-1.54.1.jar;%APP_HOME%\lib\grpc-netty-shaded-1.54.1.jar;%APP_HOME%\lib\grpc-core-1.54.1.jar;%APP_HOME%\lib\grpc-protobuf-1.54.1.jar;%APP_HOME%\lib\grpc-protobuf-lite-1.54.1.jar;%APP_HOME%\lib\grpc-api-1.54.1.jar;%APP_HOME%\lib\guava-32.0.1-jre.jar;%APP_HOME%\lib\jackson-dataformat-toml-2.15.2.jar;%APP_HOME%\lib\jackson-datatype-jdk8-2.15.2.jar;%APP_HOME%\lib\jackson-databind-2.15.2.jar;%APP_HOME%\lib\jackson-core-2.15.2.jar;%APP_HOME%\lib\jackson-annotations-2.15.2.jar;%APP_HOME%\lib\jackson-datatype-jsr310-2.15.2.jar;%APP_HOME%\lib\gson-2.10.1.jar;%APP_HOME%\lib\micrometer-core-1.9.9.jar;%APP_HOME%\lib\nexus-sdk-0.3.0-alpha.jar;%APP_HOME%\lib\slf4j-api-2.0.9.jar;%APP_HOME%\lib\antlr4-runtime-4.13.2.jar;%APP_HOME%\lib\checker-qual-3.48.3.jar;%APP_HOME%\lib\grpc-context-1.54.1.jar;%APP_HOME%\lib\failureaccess-1.0.1.jar;%APP_HOME%\lib\listenablefuture-9999.0-empty-to-avoid-conflict-with-guava.jar;%APP_HOME%\lib\tally-core-0.13.0.jar;%APP_HOME%\lib\jsr305-3.0.2.jar;%APP_HOME%\lib\error_prone_annotations-2.18.0.jar;%APP_HOME%\lib\j2objc-annotations-2.8.jar;%APP_HOME%\lib\HdrHistogram-2.1.12.jar;%APP_HOME%\lib\LatencyUtils-2.0.3.jar;%APP_HOME%\lib\perfmark-api-0.25.0.jar;%APP_HOME%\lib\annotations-4.1.1.4.jar;%APP_HOME%\lib\animal-sniffer-annotations-1.21.jar;%APP_HOME%\lib\proto-google-common-protos-2.9.0.jar;%APP_HOME%\lib\protobuf-java-3.21.7.jar


@rem Execute worker
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %WORKER_OPTS%  -classpath "%CLASSPATH%" com.ffpromo.worker.WorkerMainKt %*

:end
@rem End local scope for the variables with windows NT shell
if %ERRORLEVEL% equ 0 goto mainEnd

:fail
rem Set variable WORKER_EXIT_CONSOLE if you need the _script_ return code instead of
rem the _cmd.exe /c_ return code!
set EXIT_CODE=%ERRORLEVEL%
if %EXIT_CODE% equ 0 set EXIT_CODE=1
if not ""=="%WORKER_EXIT_CONSOLE%" exit %EXIT_CODE%
exit /b %EXIT_CODE%

:mainEnd
if "%OS%"=="Windows_NT" endlocal

:omega
