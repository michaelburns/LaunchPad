# { Launch-Pad }
[![License: Proprietary](https://img.shields.io/badge/License-Non--Commercial-red.svg)](https://github.com/michaelburns/LaunchPad/blob/master/LICENSE)

### PowerShell Command Center
##### Automation for Everyone
--------------

ASP.NET Core 10 MVC, cross-platform (macOS, Linux, Windows Server).

A centralized web portal for managing, launching, and scheduling PowerShell scripts with role-based access control, auditing, and syntax highlighting. Powered by PowerShell 7 (`Microsoft.PowerShell.SDK`), so user scripts run on every platform PowerShell 7 supports.

This project is looking for contributors. If you have a feature you'd like to see implemented or a bug you'd like fixed, the best and fastest way to make that happen is to implement it and submit it back upstream for consideration. All contributions will be given thorough consideration.

#### Run it locally

Prerequisites:
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- `dotnet tool install --global dotnet-ef` (once)

```bash
git clone https://github.com/michaelburns/LaunchPad.git
cd LaunchPad/LaunchPad
dotnet dev-certs https --trust     # one-time, prompts for keychain password
dotnet ef database update          # creates launchpad.db (SQLite)
dotnet run                         # uses Properties/launchSettings.json
```

Open https://localhost:5181 (HTTP requests on :5180 redirect to HTTPS). The Hangfire dashboard is at `/Scripts/Jobs`.

#### Storage

- **App data** → `launchpad.db` (SQLite, EF Core)
- **Background jobs** → `launchpad-hangfire.db` (SQLite, Hangfire.Storage.SQLite)
- **Scripts on disk** → `./Scripts/*.ps1` (folder configurable via `PowerShellScripts:FolderLocation`)

To use a different store (Postgres, SQL Server, etc.) swap the EF Core and Hangfire providers in `Program.cs` and update the connection strings in `appsettings.json`.

#### Authentication

- **Production (Windows Server)**: Negotiate / Windows Authentication via `Microsoft.AspNetCore.Authentication.Negotiate`. Behaves the same as classic IIS Windows Auth.
- **Development (any OS)**: an `ASPNETCORE_ENVIRONMENT=Development` build automatically signs requests in as the seeded `administrator` account so the role-protected pages are reachable on machines without an AD domain.


#### Key Features
* Secure central location for all your scripts
* User/Role Management
* Auditing - who ran what when
* Syntax highlighting editor
* Launch scripts from the web
* Schedule scripts with recurring options
* Ability to leverage parameters and variables in your scripts
* View results

--------------
#### Screenshots

##### Scripts Dashboard

![Launch-Pad Dashboard](http://i.imgur.com/YhM1Q2U.png)

##### Launching Scripts with Parameters

![Launch-Pad Launch Script with Params](http://i.imgur.com/9GwPf3m.png)

##### View Output

![Launch-Pad View Output](http://i.imgur.com/xNLBn8E.png)

##### Schedule 

![Launch-Pad Schedule Script with Params](http://i.imgur.com/NcoVMzQ.png)


##### Create and Edit Scripts 

![Launch-Pad Create and Edit Scripts](http://i.imgur.com/fp2KRy4.png)

--------------


#### Roadmap
* Define custom end user roles (Exchange, Business Departments)
* Publish scripts to dashboard for end users to launch/schedule scripts they need
* Export and/or email script results
* Email alerts on failures
* Version control for scripts

--------------


#### Built With
* [.NET 10 + ASP.NET Core MVC](https://learn.microsoft.com/aspnet/core/) - Web framework
* [PowerShell SDK 7.5](https://github.com/PowerShell/PowerShell) - Cross-platform script execution
* [HangFire](https://www.hangfire.io/) - Background job processing
* [Entity Framework Core 10](https://learn.microsoft.com/ef/core/) - Data access (SQLite by default)
* [Ace.js](https://ace.c9.io/) - Code editor with syntax highlighting
* [Bootstrap](https://getbootstrap.com/) - UI framework
