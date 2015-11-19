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
            var jobService = new JobServices();
            jobService.UpdateJob(filterContext.BackgroundJob.Id, Status.Completed);
        }

        public void OnPerforming(PerformingContext filterContext)
        {
            var jobService = new JobServices();
            var scriptName = filterContext.BackgroundJob.Job.Args[0].ToString();
            jobService.UpdateJob(filterContext.BackgroundJob.Id, Status.Running, null, scriptName);
        }

        public void OnStateElection(ElectStateContext context)
        {
            var jobService = new JobServices();
            var failedState = context.CandidateState as FailedState;
            if (failedState != null)
            {
                jobService.UpdateJob(context.BackgroundJob.Id, Status.Failed, failedState.Exception.Message);
            }
        }
    }
}
