using AutoMapper;
using Hangfire;
using Hangfire.Storage.SQLite;
using LaunchPad.Data;
using LaunchPad.Policies;
using LaunchPad.Services;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection");
var hangfireConnection = builder.Configuration.GetConnectionString("HangfireConnection");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(defaultConnection));

builder.Services.AddAutoMapper(typeof(MappingProfile));

builder.Services.AddControllersWithViews();

builder.Services.AddHangfire(config => config.UseSQLiteStorage(ParseSqliteFilename(hangfireConnection)));
builder.Services.AddHangfireServer();

builder.Services.AddTransient<IScriptRepository, ScriptRepository>();
builder.Services.AddTransient<IScriptIO, ScriptIO>();
builder.Services.AddTransient<IJobServices, JobServices>();
builder.Services.AddTransient<Seeder>();

builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
    .AddNegotiate();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Administrator", policy =>
        policy.Requirements.Add(new RoleRequirement("Administrator")));
    options.AddPolicy("Author", policy =>
        policy.Requirements.Add(new RoleRequirement("Author")));
    options.AddPolicy("Launcher", policy =>
        policy.Requirements.Add(new RoleRequirement("Launcher")));
});
builder.Services.AddScoped<IAuthorizationHandler, RoleHandler>();

builder.Services.AddHttpContextAccessor();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Home/Error");
}

app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();

if (app.Environment.IsDevelopment())
{
    app.UseMiddleware<LaunchPad.Auth.DevAutoSignInMiddleware>();
}

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// Inject a dark stylesheet into Hangfire's HTML responses so the dashboard doesn't
// flash white when an operator clicks Audit. Buffers the response on /Scripts/Jobs
// and inserts a <link> just before </head>; non-HTML responses (JSON polls, the
// metrics endpoints) pass through untouched.
app.Use(async (context, next) =>
{
    if (!context.Request.Path.StartsWithSegments("/Scripts/Jobs"))
    {
        await next();
        return;
    }
    var originalBody = context.Response.Body;
    using var buffer = new System.IO.MemoryStream();
    context.Response.Body = buffer;
    try { await next(); }
    finally { context.Response.Body = originalBody; }

    var ct = context.Response.ContentType ?? string.Empty;
    if (ct.StartsWith("text/html", System.StringComparison.OrdinalIgnoreCase))
    {
        buffer.Seek(0, System.IO.SeekOrigin.Begin);
        var html = await new System.IO.StreamReader(buffer, System.Text.Encoding.UTF8).ReadToEndAsync();
        var inject = "<link rel=\"stylesheet\" href=\"/css/hangfire-dark.css\">";
        var idx = html.LastIndexOf("</head>", System.StringComparison.OrdinalIgnoreCase);
        if (idx >= 0) html = html.Substring(0, idx) + inject + html.Substring(idx);
        var bytes = System.Text.Encoding.UTF8.GetBytes(html);
        context.Response.ContentLength = bytes.Length;
        await originalBody.WriteAsync(bytes);
    }
    else
    {
        buffer.Seek(0, System.IO.SeekOrigin.Begin);
        await buffer.CopyToAsync(originalBody);
    }
});

app.UseHangfireDashboard("/Scripts/Jobs");

LaunchPad.Services.HangfireServiceLocator.ServiceProvider = app.Services;

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<Seeder>();
    seeder.Seed();
}

app.Run();

static string ParseSqliteFilename(string connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString)) return "launchpad-hangfire.db";
    foreach (var part in connectionString.Split(';'))
    {
        var kv = part.Split('=', 2);
        if (kv.Length == 2 && kv[0].Trim().Equals("Data Source", StringComparison.OrdinalIgnoreCase))
            return kv[1].Trim();
    }
    return connectionString;
}
