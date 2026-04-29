using Hangfire.Common;
using Hangfire.Server;
using Hangfire.States;
using LaunchPad.Models;
using Microsoft.Extensions.DependencyInjection;

namespace LaunchPad.Services
{
    // Hangfire instantiates filter attributes itself, so DI cannot inject services
    // here. We resolve IJobServices through a static service-provider hook set in
    // Program.cs after the host is built.
    public class UpdateJobStatusFilter : JobFilterAttribute, IServerFilter, IElectStateFilter
    {
        private static IJobServices Resolve()
        {
            var sp = HangfireServiceLocator.ServiceProvider
                     ?? throw new System.InvalidOperationException("HangfireServiceLocator.ServiceProvider has not been set.");
            return sp.CreateScope().ServiceProvider.GetRequiredService<IJobServices>();
        }

        public void OnPerformed(PerformedContext filterContext)
        {
            Resolve().UpdateJob(filterContext.BackgroundJob.Id, Status.Completed);
        }

        public void OnPerforming(PerformingContext filterContext)
        {
            var scriptName = filterContext.BackgroundJob.Job.Args[0].ToString();
            Resolve().UpdateJob(filterContext.BackgroundJob.Id, Status.Running, null, scriptName);
        }

        public void OnStateElection(ElectStateContext context)
        {
            if (context.CandidateState is FailedState failedState)
            {
                Resolve().UpdateJob(context.BackgroundJob.Id, Status.Failed, failedState.Exception.Message);
            }
        }
    }

    public static class HangfireServiceLocator
    {
        public static System.IServiceProvider ServiceProvider { get; set; }
    }
}
