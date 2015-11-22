using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Hangfire;
using Hangfire.Annotations;
using Hangfire.Dashboard;
using Microsoft.AspNet.Builder;
using Microsoft.AspNet.Hosting;
using Microsoft.Owin.Builder;
using Owin;

namespace LaunchPad.Services
{
    using Microsoft.Extensions.DependencyInjection;
    using AppFunc = Func<IDictionary<string, object>, Task>;

    public static class IApplicationBuilderExtensions
    {
        public static IApplicationBuilder UseHangfireServer([NotNull] this IApplicationBuilder builder)
        {
            return builder.UseHangfireServer(new BackgroundJobServerOptions());
        }

        public static IApplicationBuilder UseHangfireServer(
            [NotNull] this IApplicationBuilder builder,
            [NotNull] BackgroundJobServerOptions options)
        {
            return builder.UseHangfireServer(options, JobStorage.Current);
        }

        public static IApplicationBuilder UseHangfireServer(
            [NotNull] this IApplicationBuilder builder,
            [NotNull] BackgroundJobServerOptions options,
            [NotNull] JobStorage storage)
        {
            if (builder == null) throw new ArgumentNullException("builder");
            if (options == null) throw new ArgumentNullException("options");
            if (storage == null) throw new ArgumentNullException("storage");

            var server = new BackgroundJobServer(options, storage);

            var lifetime = builder.ApplicationServices.GetRequiredService<IApplicationLifetime>();
            lifetime.ApplicationStopped.Register(server.Dispose);

            return builder;
        }

        public static IApplicationBuilder UseHangfireDashboard([NotNull] this IApplicationBuilder builder)
        {
            return builder.UseHangfireDashboard("/hangfire");
        }

        public static IApplicationBuilder UseHangfireDashboard(
            [NotNull] this IApplicationBuilder builder,
            [NotNull] string pathMatch)
        {
            return builder.UseHangfireDashboard(pathMatch, new DashboardOptions());
        }

        public static IApplicationBuilder UseHangfireDashboard(
            [NotNull] this IApplicationBuilder builder,
            [NotNull] string pathMatch,
            [NotNull] DashboardOptions options)
        {
            return builder.UseHangfireDashboard(pathMatch, options, JobStorage.Current);
        }

        public static IApplicationBuilder UseHangfireDashboard(
            [NotNull] this IApplicationBuilder builder,
            [NotNull] string pathMatch,
            [NotNull] DashboardOptions options,
            [NotNull] JobStorage storage)
        {
            if (builder == null) throw new ArgumentNullException(nameof(builder));
            if (pathMatch == null) throw new ArgumentNullException(nameof(pathMatch));
            if (options == null) throw new ArgumentNullException(nameof(options));
            if (storage == null) throw new ArgumentNullException(nameof(storage));

            return builder.Map(pathMatch, subApp =>
            {
                subApp.UseOwin(next =>
                {
                    next(MiddlewareExtensions.UseHangfireDashboard(options, storage, DashboardRoutes.Routes));
                });
            });
        }
    }
}
