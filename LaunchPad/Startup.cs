using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using LaunchPad.Data;
using Microsoft.EntityFrameworkCore;
using Hangfire;
using LaunchPad.Policies;
using LaunchPad.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Server.IISIntegration;

namespace LaunchPad
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            // Add framework services.
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection")));

            // Add framework services.
            services.AddMvc();
            services.AddHangfire(config => config.UseSqlServerStorage(Configuration.GetConnectionString("DefaultConnection")));

            // Add DI
            services.AddTransient<IScriptRepository, PowerShellRepository>();
            services.AddTransient<IScriptIO, ScriptIO>();
            services.AddTransient<IJobServices, JobServices>();
            services.AddTransient<Seeder>();
            services.AddTransient<AdminRequirement>();

            // Authentication
            services.AddAuthentication(IISDefaults.AuthenticationScheme);

            // Authorization
            services.AddAuthorization(options =>
            {
                // TODO:This could be defined by a database "Role" and "Assignment"
                options.AddPolicy("Administrator", policy =>
                    policy.Requirements.Add(new AdminRequirement()));
                options.AddPolicy("Author", policy =>
                    policy.Requirements.Add(new AuthorRequirement()));
            });
            services.AddScoped<IAuthorizationHandler, AdminHandler>();
            services.AddScoped<IAuthorizationHandler, AuthorHandler>();

            services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
        {
            loggerFactory.AddConsole(Configuration.GetSection("Logging"));
            loggerFactory.AddDebug();

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseBrowserLink();
            }
            else
            {
                app.UseExceptionHandler("/Home/Error");
            }

            app.UseStaticFiles();

            app.UseMvc(routes =>
            {
                routes.MapRoute(
                    name: "default",
                    template: "{controller=Home}/{action=Index}/{id?}");
            });

            // HangFire
            // ToDo: EF Migrations won't work if you have these next lines uncommneted because the application is trying to use the DB before it's created - it will fail. May want to move the seeder up first and actually seed the db.
            app.UseHangfireServer();
            app.UseHangfireDashboard("/PowerShell/Jobs");

            if (env.IsDevelopment())
            {
                // Seed the database
                using (var scope = app.ApplicationServices.CreateScope())
                {
                    var seeder = scope.ServiceProvider.GetService<Seeder>();
                    seeder.Seed();
                }
            }

        }
    }
}
