using Hangfire.Common;
using Hangfire.Server;
using Hangfire.States;
using LaunchPad.Models;

namespace LaunchPad.Services
{
    public class UpdateJobStatusFilter : JobFilterAttribute, IServerFilter, IElectStateFilter
    {
        public void OnPerformed(PerformedContext filterContext)
        {
            var jobServices = new JobServices();
            jobServices.UpdateJob(filterContext.BackgroundJob.Id, Status.Completed);
        }

        public void OnPerforming(PerformingContext filterContext)
        {
            var jobServices = new JobServices();
            var scriptName = filterContext.BackgroundJob.Job.Args[0].ToString(); // TODO: test var scriptName = filterContext.BackgroundJob.Job.Method.Name;
            jobServices.UpdateJob(filterContext.BackgroundJob.Id, Status.Running, null, scriptName);
        }

        public void OnStateElection(ElectStateContext context)
        {
            var jobServices = new JobServices();
            if (context.CandidateState is FailedState failedState)
            {
                jobServices.UpdateJob(context.BackgroundJob.Id, Status.Failed, failedState.Exception.Message);
            }
        }
    }
}
