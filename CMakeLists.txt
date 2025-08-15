cmake_minimum_required(VERSION 3.22)

project(DR_KeyboardTracker LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 找 libobs
find_package(libobs REQUIRED)

# 設定版本資訊
set(OBS_VERSION_MAJOR 1)
set(OBS_VERSION_MINOR 0)
set(OBS_VERSION_PATCH 0)
set(OBS_VERSION_CANONICAL "1.0.0")
set(OBS_COMPANY_NAME "Godpriest")
set(OBS_PRODUCT_NAME "DR_KeyboardTracker")
set(OBS_COMMENTS "Keyboard and mouse input tracker plugin for OBS Studio")
set(OBS_LEGAL_COPYRIGHT "@2025 Godpriest")

# 取得 nlohmann_json（header-only）
include(FetchContent)
set(FETCHCONTENT_QUIET OFF)
FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(nlohmann_json)

# 處理 Windows rc 檔案
if(WIN32)
  configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/cmake/windows/obs-module.rc.in
    ${CMAKE_CURRENT_BINARY_DIR}/obs-module.rc
    @ONLY
  )
  set(RC_FILE ${CMAKE_CURRENT_BINARY_DIR}/obs-module.rc)
else()
  set(RC_FILE "")
endif()

add_library(DR_KeyboardTracker MODULE
  src/dr_keyboard_tracker.cpp
  ${RC_FILE}
)

target_include_directories(DR_KeyboardTracker PRIVATE)

target_link_libraries(DR_KeyboardTracker PRIVATE
  OBS::libobs
  nlohmann_json::nlohmann_json
  user32
  windowscodecs
  shell32
)

if(MSVC)
  target_compile_definitions(DR_KeyboardTracker PRIVATE _CRT_SECURE_NO_WARNINGS)
  target_compile_options(DR_KeyboardTracker PRIVATE /permissive- /Zc:__cplusplus /utf-8)
endif()

# Windows 外掛輸出為 .dll，OBS 期望無前綴 lib
set_target_properties(DR_KeyboardTracker PROPERTIES
  PREFIX ""
  OUTPUT_NAME "DR_KeyboardTracker"
)

# 安裝語系檔（供 OBS 載入）
# OBS 尋找語系的預設結構為 data/obs-plugins/<id>/locale/*.ini
install(DIRECTORY data/obs-plugins/ DESTINATION data/obs-plugins)


