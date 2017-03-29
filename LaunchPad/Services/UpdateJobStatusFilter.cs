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
            var _jobServices = new JobServices();
            _jobServices.UpdateJob(filterContext.BackgroundJob.Id, Status.Completed);
        }

        public void OnPerforming(PerformingContext filterContext)
        {
            var _jobServices = new JobServices();
            var scriptName = filterContext.BackgroundJob.Job.Args[0].ToString(); // TODO: test var scriptName = filterContext.BackgroundJob.Job.Method.Name;
            _jobServices.UpdateJob(filterContext.BackgroundJob.Id, Status.Running, null, scriptName);
        }

        public void OnStateElection(ElectStateContext context)
        {
            var _jobServices = new JobServices();
            var failedState = context.CandidateState as FailedState;
            if (failedState != null)
            {
                _jobServices.UpdateJob(context.BackgroundJob.Id, Status.Failed, failedState.Exception.Message);
            }
        }
    }
}
