# { Launch-Pad }
[![License: Proprietary](https://img.shields.io/badge/License-Non--Commercial-red.svg)](https://github.com/michaelburns/LaunchPad/blob/master/LICENSE)

### PowerShell Command Center
##### Automation for Everyone
--------------

ASP.NET Core MVC

A centralized web portal for managing, launching, and scheduling PowerShell scripts with role-based access control, auditing, and syntax highlighting.

This project is looking for contributors. If you have a feature you'd like to see implemented or a bug you'd like fixed, the best and fastest way to make that happen is to implement it and submit it back upstream for consideration. All contributions will be given thorough consideration.

#### Get started with v0.0.1-alpha
- [Install Launch-Pad](https://github.com/michaelburns/LaunchPad/releases/download/v0.0.1-alpha/launch-pad.exe)
  - [Release Notes](https://github.com/michaelburns/LaunchPad/releases/tag/v0.0.1-alpha)


#### Get started contributing:
- Install the [.NET SDK](https://dotnet.microsoft.com/download)
- Clone the project to [Visual Studio](https://visualstudio.microsoft.com/vs/community/) or [Visual Studio Code](https://code.visualstudio.com/)
- Copy `appsettings.json` and configure your local database connection string
- Run the Entity Framework migrations from the ./LaunchPad directory:
  - `dotnet ef migrations add InitialDB`
  - `dotnet ef database update`

##### Default Admin Account:
Username: admin
Password: Admin1234!


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
* Migrate to modern .NET

--------------


#### Built With
* [HangFire](https://www.hangfire.io/) - Background job processing
* [Ace.js](https://ace.c9.io/) - Code editor with syntax highlighting
* [Entity Framework Core](https://docs.microsoft.com/en-us/ef/core/) - Data access
* [Bootstrap](https://getbootstrap.com/) - UI framework
